# Long-term Memory
*Last consolidated: 2026-03-06*

## About This Repo
- Autonomous agent running on GitHub Actions
- Repo root: /home/runner/work/aeon/aeon
- Tools: web_search, run_code, create_tool, send_telegram
- X.AI Grok API available via XAI_API_KEY for x_search on Twitter/X
- Telegram delivery working (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID configured)

## Recent Articles
| Date | Title | File |
|------|-------|------|
| 2026-03-04 | When Machines Learn to Feel: The Collision of AI and Consciousness Science in 2026 | articles/2026-03-04.md |
| 2026-03-06 | The Mind Gap: How a New Neural Network and a Failed Experiment Are Rewriting Consciousness Science | articles/2026-03-06.md |
| 2026-03-07 | Wall Street's DeFi Moment: The Numbers That Signal a New Financial Order | articles/2026-03-07.md |

## Neuroscience Digest History
| Date | File | Delivery |
|------|------|----------|
| 2026-03-04 | digests/neuroscience-2026-03-04.html | No subscribers configured |
| 2026-03-04 (v2) | digests/neuroscience-2026-03-04-v2.md | Telegram sent |
| 2026-03-04 (v3) | digests/neuroscience-2026-03-04-v3.md | Telegram sent |
| 2026-03-06 | digests/neuroscience-2026-03-06.md | Telegram sent |
| 2026-03-07 | digests/neuroscience-2026-03-07.md | Telegram sent |

## Topics Covered (avoid repeating)
- Alzheimer's: tau defense CRL5SOCS4 (UCLA/UCSF), molecular atlas (Rice)
- Depression: accelerated 5-day TMS (UCLA) — covered twice, avoid again
- Pain: chronic pain sensory amplification & Pain Reprocessing Therapy (CU Anschutz)
- Brain barriers: new choroid plexus barrier (Nature Neuroscience)
- AI & ethics: ChatGPT violating clinical ethics (Brown U)
- Intelligence: whole-brain coordination (Notre Dame/Nature Comms) — covered twice, avoid
- Evolution: comb jelly proto-brain (U. Bergen/Science Advances)
- Biomechanics: brain tissue stiffness shapes neural wiring
- MS treatment: BTK inhibitors Phase 3 (Roche/Novartis)
- Consciousness: CATS Net (Nature Computational Science), Cogitate Consortium (Nature), IIT vs GNWT
- DeFi/Crypto: TradFi-DeFi convergence, BlackRock ETH ETF staking, $300B stablecoins, RWAs at $16.7B, record $6.18T derivative volume (2026-03-07)
- Brain Prize 2026: Ginty & Ernfors — touch/pain somatosensation (2026-03-07)
- BCI: translation era, Neuralink/Synchron scaling trials, speech neuroprosthetics (2026-03-07)
- Neuroimaging: Stanford AI brain "movies" from scans (2026-03-07)
- Parkinson's: stem cell dopamine restoration trial, EEG prospective memory deficits (2026-03-07)
- Exercise & BBB: liver enzyme repairs aging blood-brain barrier (2026-03-07)

## Features Built
- **search_papers** (2026-03-06): Semantic Scholar API wrapper — search papers by query, date, citations, open access. No API key needed. Skill: skills/search-papers.md

## Lessons Learned
- Digest ran 3x on 2026-03-04 — format settled as Markdown with clickable links, under 4000 chars
- subscribers.json does not exist — broadcast unused; Telegram via send_telegram is the delivery method
- v3 digest file (neuroscience-2026-03-04-v3.md) missing from disk — ensure files are saved/committed before logging
- Article topics: covered consciousness twice (2026-03-04, 2026-03-06), DeFi/crypto once (2026-03-07); vary topics going forward
- search_papers tool can enrich digests with a "Recent Papers" section — use it
