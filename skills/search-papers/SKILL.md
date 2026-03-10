---
name: Search Academic Papers
description: Search Semantic Scholar for academic papers by topic, date range, and sort order
---

# Search Academic Papers Tool

This skill registers a `search_papers` tool that queries the [Semantic Scholar Academic Graph API](https://api.semanticscholar.org/) to find academic papers. No API key required (uses the free tier with automatic retry on rate limits).

## Setup

No environment variables needed. The Semantic Scholar API is free and keyless.

**Note:** The free tier is rate-limited to ~100 requests/5 minutes. The tool includes automatic retry with backoff for 429 errors.

## Tool Registration

At the start of any workflow that needs paper search, register the tool:

```js
// This tool is registered via create_tool at the start of workflows that need it.
// See the code below for the full implementation.
```

### create_tool call

```yaml
name: search_papers
description: >
  Search for academic papers on Semantic Scholar. Returns titles, authors,
  abstracts, citation counts, publication dates, journal info, and DOI links.
  Useful for research, article writing, and digest generation. No API key required.
input_schema:
  type: object
  required: [query]
  properties:
    query:
      type: string
      description: "Search query (e.g. 'brain computer interface', 'CRISPR gene editing')"
    limit:
      type: number
      description: "Number of results to return (1-20, default 5)"
    year_from:
      type: string
      description: "Filter papers published on or after this date. Format: YYYY or YYYY-MM-DD"
    year_to:
      type: string
      description: "Filter papers published on or before this date. Format: YYYY or YYYY-MM-DD"
    sort:
      type: string
      enum: [relevance, publicationDate, citationCount]
      description: "Sort order (default: relevance). 'publicationDate' = newest first, 'citationCount' = most-cited first."
    open_access_only:
      type: boolean
      description: "If true, only return papers with open access PDFs (default: false)"
```

### Implementation

```js
const limit = Math.min(Math.max(input.limit || 5, 1), 20);
const fields = "title,authors,year,abstract,url,citationCount,publicationDate,journal,externalIds,openAccessPdf";

const params = new URLSearchParams({
  query: input.query,
  limit: String(limit),
  fields: fields
});

// Date range filter
if (input.year_from || input.year_to) {
  const from = input.year_from || "";
  const to = input.year_to || "";
  params.set("publicationDateOrYear", `${from}:${to}`);
}

// Sort
if (input.sort && input.sort !== "relevance") {
  params.set("sort", `${input.sort}:desc`);
}

const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params}`;

let lastError = null;
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "AeonBot/1.0" }
    });

    if (r.status === 429) {
      lastError = "Rate limited (429). Retrying...";
      continue;
    }

    if (!r.ok) {
      return { error: `API returned ${r.status}: ${await r.text()}` };
    }

    const data = await r.json();

    if (!data.data || data.data.length === 0) {
      return { total: 0, papers: [], message: "No papers found matching your query." };
    }

    const papers = data.data.map((p, i) => {
      const doi = p.externalIds?.DOI;
      const arxiv = p.externalIds?.ArXiv;
      const oaPdf = p.openAccessPdf?.url || null;

      return {
        rank: i + 1,
        title: p.title,
        authors: (p.authors || []).slice(0, 5).map(a => a.name).join(", ") +
                 ((p.authors || []).length > 5 ? ` (+${p.authors.length - 5} more)` : ""),
        year: p.year,
        publicationDate: p.publicationDate,
        journal: p.journal?.name || null,
        citationCount: p.citationCount || 0,
        abstract: p.abstract ? (p.abstract.length > 300 ? p.abstract.slice(0, 300) + "..." : p.abstract) : null,
        semanticScholarUrl: p.url,
        doi: doi ? `https://doi.org/${doi}` : null,
        arxiv: arxiv ? `https://arxiv.org/abs/${arxiv}` : null,
        openAccessPdf: oaPdf || null
      };
    });

    // Filter open access if requested
    const filtered = input.open_access_only
      ? papers.filter(p => p.openAccessPdf)
      : papers;

    return {
      total: data.total,
      showing: filtered.length,
      papers: filtered
    };

  } catch (e) {
    lastError = e.message;
  }
}

return { error: `Failed after 3 attempts. Last error: ${lastError}` };
```

## Usage Examples

### Find recent papers on a topic
```
search_papers({ query: "brain computer interface", limit: 5, year_from: "2026", sort: "publicationDate" })
```

### Find most-cited papers on a topic (all time)
```
search_papers({ query: "transformer attention mechanism", limit: 10, sort: "citationCount" })
```

### Find open access papers only
```
search_papers({ query: "CRISPR gene editing", limit: 5, open_access_only: true, year_from: "2025" })
```

### Find papers in a date range
```
search_papers({ query: "consciousness neural correlates", year_from: "2024-01-01", year_to: "2026-03-06" })
```

## Output Format

Returns a JSON object:
```json
{
  "total": 11166,
  "showing": 3,
  "papers": [
    {
      "rank": 1,
      "title": "Paper Title",
      "authors": "Author1, Author2, Author3",
      "year": 2026,
      "publicationDate": "2026-01-25",
      "journal": "Nature Neuroscience",
      "citationCount": 42,
      "abstract": "First 300 chars of abstract...",
      "semanticScholarUrl": "https://www.semanticscholar.org/paper/...",
      "doi": "https://doi.org/10.1234/...",
      "arxiv": "https://arxiv.org/abs/...",
      "openAccessPdf": "https://..."
    }
  ]
}
```

## Integration Notes

- **In digests:** Use to add a "Recent Papers" section with 2-3 relevant papers
- **In articles:** Use to find source papers and cite them properly with DOI links
- **Rate limits:** Free tier allows ~100 requests/5 min. Spread calls out if doing bulk searches.
