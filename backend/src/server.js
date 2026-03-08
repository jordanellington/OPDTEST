import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { getOrBuildCache, retrieveChunks, isCached } from './rag.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3002;
const ALFRESCO_BASE = process.env.ALFRESCO_BASE_URL || 'https://secure.covi3.com';
const ALFRESCO_API = `${ALFRESCO_BASE}/alfresco/api/-default-/public`;
const SHARE_PROXY = `${ALFRESCO_BASE}/share/proxy/alfresco`;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Store sessions in memory (dev only)
const sessions = new Map();

// --------------- OPD Site Constants ---------------

const OPD_SITE_ID = 'spRUazMwUvPbaCTh';
const OPD_DOCLIB_ID = '591e57bc-466b-40da-8dc3-5a2bc5233b0e';

// --------------- CAS SSO Login Helper ---------------

async function casLogin(username, password) {
  const CAS_LOGIN = `${ALFRESCO_BASE.replace('secure.', 'secure-login.')}/cas/login`;
  const SERVICE_URL = `${ALFRESCO_BASE}/share/page/`;
  const casUrl = `${CAS_LOGIN}?service=${encodeURIComponent(SERVICE_URL)}`;

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Step 1: GET the CAS login page
  const loginPageResp = await fetch(casUrl, { headers: browserHeaders });
  const loginPageHtml = await loginPageResp.text();

  const setCookies = loginPageResp.headers.raw()['set-cookie'] || [];
  const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');
  console.log('[auth] CAS GET status:', loginPageResp.status, '| cookies:', setCookies.length);

  const executionMatch = loginPageHtml.match(/name="execution"\s+value="([^"]+)"/);
  if (!executionMatch) throw new Error('Could not parse CAS login page');
  const execution = executionMatch[1];

  // Step 2: POST credentials to CAS
  const formBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&execution=${encodeURIComponent(execution)}&_eventId=submit&geolocation=`;

  const casPostResp = await fetch(casUrl, {
    method: 'POST',
    headers: {
      ...browserHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr,
      'Origin': 'https://secure-login.covi3.com',
      'Referer': casUrl,
    },
    body: formBody,
    redirect: 'manual',
  });

  const casRedirectUrl = casPostResp.headers.get('location');
  console.log('[auth] CAS POST status:', casPostResp.status, '| redirect:', casRedirectUrl?.substring(0, 150));

  if (!casRedirectUrl || !casRedirectUrl.includes('ticket=')) {
    const body = await casPostResp.text();
    if (body.includes('credentials') || body.includes('nvalid') || body.includes('denied')) {
      throw new Error('INVALID_CREDENTIALS');
    }
    throw new Error('CAS did not redirect with ticket');
  }

  // Step 3: Follow redirect to Share
  const shareResp = await fetch(casRedirectUrl, { redirect: 'manual' });
  const shareCookies = shareResp.headers.raw()['set-cookie'] || [];
  let allCookies = shareCookies.map(c => c.split(';')[0]);

  if (shareResp.headers.get('location')) {
    const nextResp = await fetch(shareResp.headers.get('location'), {
      redirect: 'manual',
      headers: { 'Cookie': allCookies.join('; ') },
    });
    const nextCookies = nextResp.headers.raw()['set-cookie'] || [];
    const nextParsed = nextCookies.map(c => c.split(';')[0]);
    const cookieMap = new Map();
    for (const c of [...allCookies, ...nextParsed]) {
      const name = c.split('=')[0];
      cookieMap.set(name, c);
    }
    allCookies = [...cookieMap.values()];
  }

  let jsessionId = null;
  for (const c of allCookies) {
    const match = c.match(/JSESSIONID=([^;]+)/);
    if (match) { jsessionId = match[1]; break; }
  }
  if (!jsessionId) throw new Error('Failed to obtain JSESSIONID from Share');

  let csrfToken = null;
  for (const c of allCookies) {
    const match = c.match(/Alfresco-CSRFToken=(.+)/);
    if (match) { csrfToken = decodeURIComponent(match[1]); break; }
  }

  const cookieString = allCookies.join('; ');
  return { jsessionId, cookieString, csrfToken };
}

// --------------- Auth ---------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { jsessionId, cookieString, csrfToken } = await casLogin(username, password);
    console.log('[auth] CAS login succeeded for', username);

    const profileResp = await fetch(`${SHARE_PROXY}/api/people/${encodeURIComponent(username)}`, {
      headers: { 'Cookie': cookieString }
    });
    const profile = profileResp.ok ? await profileResp.json() : null;
    const resolvedUsername = profile?.userName || username;

    const sessionId = Buffer.from(`${resolvedUsername}:${Date.now()}`).toString('base64');
    sessions.set(sessionId, { jsessionId, cookieString, csrfToken, username: resolvedUsername });

    res.json({
      sessionId,
      user: {
        username: resolvedUsername,
        firstName: profile?.firstName || resolvedUsername,
        lastName: profile?.lastName || '',
        email: profile?.email || ''
      }
    });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/dev-login', async (req, res) => {
  const { jsessionId } = req.body;
  if (!jsessionId) {
    return res.status(400).json({ error: 'jsessionId required' });
  }
  try {
    const resp = await fetch(`${SHARE_PROXY}/api/people/admin`, {
      headers: { 'Cookie': `JSESSIONID=${jsessionId}` }
    });
    if (!resp.ok) {
      return res.status(401).json({ error: 'Invalid or expired JSESSIONID' });
    }
    const profile = await resp.json();
    const sessionId = Buffer.from(`${profile.userName}:${Date.now()}`).toString('base64');
    sessions.set(sessionId, { jsessionId, username: profile.userName });
    res.json({
      sessionId,
      user: {
        username: profile.userName,
        firstName: profile.firstName || profile.userName,
        lastName: profile.lastName || '',
        email: profile.email || ''
      }
    });
  } catch (err) {
    console.error('Dev login error:', err);
    res.status(500).json({ error: 'Session validation failed' });
  }
});

app.get('/api/auth/heartbeat', requireAuth, async (req, res) => {
  try {
    await alfrescoGet(
      `${ALFRESCO_API}/alfresco/versions/1/nodes/${OPD_DOCLIB_ID}`,
      req.session
    );
    res.json({ ok: true });
  } catch (err) {
    if (handleAlfrescoExpiry(err, req, res)) return;
    console.error('[heartbeat] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  sessions.delete(sessionId);
  res.json({ ok: true });
});

// --------------- Middleware ---------------

function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.query.sid;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.session = session;
  req.sessionId = sessionId;
  next();
}

function handleAlfrescoExpiry(err, req, res) {
  if (err.alfrescoExpired) {
    console.error('[auth] Alfresco session expired, clearing session:', req.sessionId);
    sessions.delete(req.sessionId);
    return res.status(401).json({ error: 'Session expired' });
  }
  return false;
}

async function alfrescoFetch(url, session, options = {}) {
  const { ticket, jsessionId, cookieString, csrfToken, basicAuth } = session;

  if (ticket) {
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}alf_ticket=${encodeURIComponent(ticket)}`;
    return fetch(fullUrl, options);
  }

  if (jsessionId) {
    const SHARE_API_PROXY = `${ALFRESCO_BASE}/share/proxy/alfresco-api`;
    const shareUrl = url.replace(
      `${ALFRESCO_API}`,
      `${SHARE_API_PROXY}/-default-/public`
    );
    const headers = {
      ...options.headers,
      'Cookie': cookieString || `JSESSIONID=${jsessionId}`,
      ...(csrfToken ? { 'Alfresco-CSRFToken': csrfToken } : {}),
    };
    return fetch(shareUrl, { ...options, headers });
  }

  if (basicAuth) {
    const headers = {
      ...options.headers,
      'Authorization': `Basic ${basicAuth}`
    };
    return fetch(url, { ...options, headers });
  }

  throw new Error('No valid auth method in session');
}

function checkAlfrescoSession(resp, url) {
  if (resp.status === 401 || resp.status === 403) {
    const err = new Error('Alfresco session expired');
    err.alfrescoExpired = true;
    throw err;
  }
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/html') && !url.includes('/content')) {
    console.error('[alfresco] Got HTML instead of JSON — session expired. URL:', url.substring(0, 120));
    const err = new Error('Alfresco session expired');
    err.alfrescoExpired = true;
    throw err;
  }
}

async function alfrescoGet(url, session) {
  const resp = await alfrescoFetch(url, session);
  checkAlfrescoSession(resp, url);
  return resp;
}

async function alfrescoPost(url, session, body) {
  const resp = await alfrescoFetch(url, session, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  checkAlfrescoSession(resp, url);
  return resp;
}

// --------------- Sites ---------------

app.get('/api/site', requireAuth, async (req, res) => {
  try {
    const resp = await alfrescoGet(
      `${ALFRESCO_API}/alfresco/versions/1/sites/${OPD_SITE_ID}`,
      req.session
    );
    const data = await resp.json();
    res.json(data.entry);
  } catch (err) {
    if (handleAlfrescoExpiry(err, req, res)) return;
    res.status(500).json({ error: err.message });
  }
});

// --------------- Nodes / Browsing ---------------

app.get('/api/nodes/:nodeId/children', requireAuth, async (req, res) => {
  const { nodeId } = req.params;
  const resolvedId = nodeId === 'root' ? OPD_DOCLIB_ID : nodeId;
  const { maxItems = 100, skipCount = 0, orderBy = 'name', foldersOnly } = req.query;

  let url = `${ALFRESCO_API}/alfresco/versions/1/nodes/${resolvedId}/children?maxItems=${maxItems}&skipCount=${skipCount}&orderBy=${orderBy}&include=properties,path`;
  if (foldersOnly === 'true') {
    url += `&where=(isFolder=true)`;
  }

  try {
    const resp = await alfrescoGet(url, req.session);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    if (handleAlfrescoExpiry(err, req, res)) return;
    console.error('Children error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/nodes/:nodeId', requireAuth, async (req, res) => {
  const { nodeId } = req.params;
  try {
    const resp = await alfrescoGet(
      `${ALFRESCO_API}/alfresco/versions/1/nodes/${nodeId}?include=properties,aspectNames,path`,
      req.session
    );
    const data = await resp.json();
    res.json(data.entry);
  } catch (err) {
    if (handleAlfrescoExpiry(err, req, res)) return;
    res.status(500).json({ error: err.message });
  }
});

// --------------- Search ---------------

app.post('/api/search', requireAuth, async (req, res) => {
  const { query, maxItems = 25, skipCount = 0, exact = false, sort = 'relevance', ascending = false, filters = {} } = req.body;

  const SORT_MAP = {
    date: [{ type: 'FIELD', field: 'corpkmdcf:dateOfOpinion', ascending }],
    posted: [{ type: 'FIELD', field: 'cm:modified', ascending }],
    name: [{ type: 'FIELD', field: 'cm:name', ascending }],
  };

  try {
    // Build AFTS query
    let aftsQuery = `SITE:${OPD_SITE_ID} AND TYPE:"dcf:fileUpload"`;

    // Add text search if provided
    if (query && query.trim()) {
      const searchTerm = exact ? `"${query}"` : query;
      aftsQuery += ` AND (${searchTerm})`;
    }

    // Add facet filters
    for (const [field, values] of Object.entries(filters)) {
      if (values && values.length > 0) {
        const filterClauses = values.map(v => `${field}:"${v}"`).join(' OR ');
        aftsQuery += ` AND (${filterClauses})`;
      }
    }

    console.log('[search] query:', aftsQuery);
    const resp = await alfrescoPost(
      `${ALFRESCO_API}/search/versions/1/search`,
      req.session,
      {
        query: {
          query: aftsQuery,
          language: 'afts'
        },
        paging: { maxItems, skipCount },
        include: ['properties', 'path'],
        ...(SORT_MAP[sort] ? { sort: SORT_MAP[sort] } : {}),
        facetFields: {
          facets: [
            { field: 'corpkmdcf:opinionProvider', label: 'Opinion Provider', mincount: 1 },
            { field: 'corpkmdcf:opinionTypes', label: 'Practice Area', mincount: 1 },
            { field: 'corpkmdcf:clientName', label: 'Client Name', mincount: 1 },
            { field: 'corpkmdcf:usJurisdictions', label: 'US Jurisdictions', mincount: 1 },
            { field: 'corpkmdcf:nonUsJurisdictions', label: 'Non-US Jurisdictions', mincount: 1 },
            { field: 'corpkmdcf:covingtonLawyerSigningOpinion', label: 'Signatory', mincount: 1 },
            { field: 'corpkmdcf:typeOfOffering', label: 'Offering Type', mincount: 1 },
            { field: 'corpkmdcf:typeOfSecurity', label: 'Type of Security', mincount: 1 },
            { field: 'corpkmdcf:opinionFilledWithSec', label: 'Filed with SEC', mincount: 1 },
            { field: 'corpkmdcf:covingtonOffice', label: 'Covington Office', mincount: 1 },
            { field: 'corpkmdcf:otherLawFirmClientNames', label: 'Other Law Firms', mincount: 1 },
            { field: 'corpkmdcf:registeredOfferingType', label: 'Registered Offering Type', mincount: 1 },
            { field: 'corpkmdcf:typeOfFinancing', label: 'Type of Financing', mincount: 1 },
            { field: 'corpkmdcf:typeOfTransaction', label: 'Type of Transaction', mincount: 1 },
          ]
        }
      }
    );

    const data = await resp.json();
    res.json(data);
  } catch (err) {
    if (handleAlfrescoExpiry(err, req, res)) return;
    console.error('[search] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------- Document Content / Preview ---------------

app.get('/api/nodes/:nodeId/content', requireAuth, async (req, res) => {
  const { nodeId } = req.params;
  try {
    const resp = await alfrescoFetch(
      `${ALFRESCO_API}/alfresco/versions/1/nodes/${nodeId}/content`,
      req.session
    );

    if (resp.status === 401 || resp.status === 403) {
      sessions.delete(req.sessionId);
      return res.status(401).json({ error: 'Session expired' });
    }

    const contentType = resp.headers.get('content-type');
    res.set('Content-Type', contentType);
    const disposition = req.query.download === 'true'
      ? resp.headers.get('content-disposition')
      : `inline`;
    res.set('Content-Disposition', disposition);
    const buffer = await resp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    if (handleAlfrescoExpiry(err, req, res)) return;
    res.status(500).json({ error: err.message });
  }
});

// --------------- Stats ---------------

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    // Get total document count
    const countResp = await alfrescoPost(
      `${ALFRESCO_API}/search/versions/1/search`,
      req.session,
      {
        query: {
          query: `SITE:${OPD_SITE_ID} AND TYPE:"dcf:fileUpload"`,
          language: 'afts'
        },
        paging: { maxItems: 0 },
        facetFields: {
          facets: [
            { field: 'corpkmdcf:opinionTypes', label: 'Practice Areas', mincount: 1 },
            { field: 'corpkmdcf:opinionProvider', label: 'Opinion Providers', mincount: 1 },
            { field: 'corpkmdcf:usJurisdictions', label: 'US Jurisdictions', mincount: 1 },
            { field: 'corpkmdcf:nonUsJurisdictions', label: 'Non-US Jurisdictions', mincount: 1 },
            { field: 'corpkmdcf:covingtonOffice', label: 'Offices', mincount: 1 },
            { field: 'corpkmdcf:clientName', label: 'Clients', mincount: 1 },
            { field: 'corpkmdcf:covingtonLawyerSigningOpinion', label: 'Signatories', mincount: 1 },
          ]
        }
      }
    );

    const countData = await countResp.json();

    // Extract facet data for dashboard
    const facets = {};
    const facetFields = countData.context?.facets || countData.context?.facetFields || [];
    for (const facet of facetFields) {
      facets[facet.label] = facet.buckets?.map(b => ({
        value: b.label || b.filterQuery,
        count: b.count || b.metrics?.[0]?.value?.count || 0
      })) || [];
    }

    res.json({
      totalDocuments: countData.list?.pagination?.totalItems ?? 0,
      facets,
    });
  } catch (err) {
    if (handleAlfrescoExpiry(err, req, res)) return;
    console.error('Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --------------- AI Chat (AWS Bedrock) ---------------

const bedrockClient = process.env.AWS_BEDROCK_ACCESS_KEY_ID
  ? new BedrockRuntimeClient({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_BEDROCK_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_BEDROCK_SECRET_ACCESS_KEY,
      },
    })
  : null;

const BEDROCK_MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

app.post('/api/chat', requireAuth, async (req, res) => {
  const { messages, document: doc } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!bedrockClient) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI not configured — AWS Bedrock credentials missing' })}\n\n`);
    return res.end();
  }

  let extractedText = null;
  const pageCount = parseInt(doc?.pages, 10) || 0;
  const cachedAlready = doc?.id && isCached(doc.id, doc.modified || '');

  if (doc?.id && !cachedAlready) {
    try {
      const pdfResp = await alfrescoFetch(
        `${ALFRESCO_API}/alfresco/versions/1/nodes/${doc.id}/content`,
        req.session
      );
      if (pdfResp.ok) {
        const buffer = Buffer.from(await pdfResp.arrayBuffer());
        console.log(`[chat] Fetched PDF for ${doc.name}: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

        extractedText = await new Promise((resolve, reject) => {
          const scriptPath = path.join(__dirname, '../scripts/extract_text.py');
          const proc = execFile('python3', [scriptPath], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
          });
          proc.stdin.write(buffer);
          proc.stdin.end();
        });
        console.log(`[chat] Extracted ${extractedText.length} chars of text from ${doc.name}`);
      }
    } catch (err) {
      console.error('[chat] Failed to extract PDF text:', err.message);
    }
  }

  const useRag = cachedAlready || (extractedText && (extractedText.length > 120_000 || pageCount > 40));
  let retrievedChunks = null;

  if (useRag) {
    try {
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Building document index...' })}\n\n`);
      await getOrBuildCache(doc.id, doc.modified || '', extractedText, bedrockClient);

      const latestQuestion = messages[messages.length - 1]?.content || '';
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Searching document...' })}\n\n`);
      retrievedChunks = await retrieveChunks(latestQuestion, doc.id, doc.modified || '', bedrockClient);
      console.log(`[chat] RAG: retrieved ${retrievedChunks.length} chunks for question`);
    } catch (err) {
      console.error('[chat] RAG error, falling back to truncated text:', err.message);
      extractedText = extractedText.slice(0, 120_000) + '\n\n[Document truncated due to size]';
    }
  }

  const metadataBlock = doc
    ? `Document metadata:\n- Name: ${doc.name || 'Unknown'}\n- Client: ${doc.clientName || 'Unknown'}\n- Practice Area: ${doc.practiceArea || 'Unknown'}\n- Date of Opinion: ${doc.dateOfOpinion || 'Unknown'}\n- Signatory: ${doc.signatory || 'Unknown'}\n- Pages: ${doc.pages || 'Unknown'}\n- Jurisdictions: ${doc.jurisdictions || 'Unknown'}`
    : '';

  let systemPrompt;
  if (!doc) {
    systemPrompt = 'You are a helpful legal document assistant for the Corporate Opinion Letters database at Covington & Burling LLP.';
  } else if (retrievedChunks) {
    systemPrompt = `You are a helpful legal document assistant for Covington & Burling's Corporate Opinion Letters database. You are analyzing the opinion "${doc.name}".\n\n${metadataBlock}\n\nRelevant sections from the opinion have been retrieved and provided with each question. Base your answers on these sections. Reference page numbers and section headers when available. Focus on legal substance: opinion scope, conditions, qualifications, carve-outs, and jurisdictional coverage. Do not fabricate content not present in the provided sections.`;
  } else if (extractedText) {
    systemPrompt = `You are a helpful legal document assistant for Covington & Burling's Corporate Opinion Letters database. You are analyzing the opinion "${doc.name}".\n\n${metadataBlock}\n\nThe full opinion text has been extracted and provided. Provide concise, professional answers based on the document content. Reference specific sections, page numbers, or legal citations when relevant. Focus on opinion scope, conditions, qualifications, and jurisdictional coverage.`;
  } else {
    systemPrompt = `You are a helpful legal document assistant for Covington & Burling's Corporate Opinion Letters database. You are analyzing the opinion "${doc.name}".\n\n${metadataBlock}\n\nThe document content could not be extracted. Answer based on metadata only and let the user know.`;
  }

  try {
    let bedrockMessages;
    if (retrievedChunks) {
      const latestMsg = messages[messages.length - 1];
      const chunkText = retrievedChunks.map((c, i) =>
        `[Section ${i + 1}${c.sectionHeader ? ': ' + c.sectionHeader : ''} (Page ${c.page})]\n${c.text}`
      ).join('\n\n---\n\n');

      bedrockMessages = [
        ...messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          content: `[Retrieved document sections]\n\n${chunkText}\n\n[User question]\n${latestMsg.content}`,
        },
      ];
    } else {
      bedrockMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'user' && extractedText) {
          return {
            role: 'user',
            content: `[Document content]\n${extractedText}\n\n[User question]\n${m.content}`,
          };
        }
        return { role: m.role, content: m.content };
      });
    }

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        system: systemPrompt,
        messages: bedrockMessages,
      }),
    });

    const response = await bedrockClient.send(command);

    for await (const event of response.body) {
      if (event.chunk) {
        const parsed = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: parsed.delta.text })}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[chat] Bedrock error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OPD Corporate Opinion Letters backend running on port ${PORT}`);
});
