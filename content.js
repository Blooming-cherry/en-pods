'use strict';

/* ══════════════════════════════════════════════════════════════
   DIAL — curated whitelist (home page sources)

   Each entry names its publisher, its official feed and the one
   episode being pointed at, plus the date this was checked. Text
   type is stated per show; where it has not been verified it says
   so instead of implying a transcript exists.

   `text: 'not checked'` is a real state, not a placeholder: the
   entry is listed because source, feed and episode are named, but
   the text layer has not been reviewed on this pass.
   ══════════════════════════════════════════════════════════════ */

window.DIAL_CONTENT = {
  checked: '2026-11-08',

  /* ── current affairs ───────────────────────────────────────── */
  news: [
    {
      showId: 1222114325,
      name: 'Up First',
      publisher: 'NPR',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/0e/35/25/0e352569-e694-81d9-ea55-5f935981c15a/mza_1788275989855583986.png/600x600bb.jpg',
      feed: 'https://feeds.npr.org/510318/podcast.xml',
      source: 'https://www.npr.org/podcasts/510318/up-first',
      text: 'official transcript page, not proofed against audio',
      latest: { title: 'Where will America go from here?', published: '2026-11-08', duration: 1550 }
    },
    {
      showId: 1057255460,
      name: 'The NPR Politics Podcast',
      publisher: 'NPR',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/71/15/1d/71151d33-32e7-f0e1-2a6b-412bf4835c5d/mza_9550948332778108059.jpg/600x600bb.jpg',
      feed: 'https://feeds.npr.org/510310/podcast.xml',
      source: 'https://www.npr.org/podcasts/510310/npr-politics-podcast',
      text: 'show notes only',
      latest: { title: 'How badly did partisan gerrymandering backfire?', published: '2026-11-06', duration: 1681 }
    },
    {
      showId: 1200361736,
      name: 'The Daily',
      publisher: 'The New York Times',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ab/64/66/ab6466a9-9a7d-e20e-7a3d-bc5be37d29ce/mza_15084852813176276273.jpg/600x600bb.jpg',
      feed: 'https://feeds.simplecast.com/Sl5CSM3S',
      source: 'https://www.nytimes.com/column/the-daily',
      text: 'official transcript, published per episode',
      latest: {
        title: 'Keisha Lance Bottoms on What Democrats Have to Do to Not Squander the Midterms',
        published: '2026-11-08',
        duration: 1806
      }
    },
    {
      showId: 121493675,
      name: 'NPR News Now',
      publisher: 'NPR',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/27/a0/ab/27a0abb7-817f-d80c-4fed-6fd04d424333/mza_16804553558295235422.jpg/600x600bb.jpg',
      feed: 'https://feeds.npr.org/500005/podcast.xml',
      source: 'https://www.npr.org/podcasts/500005/npr-news-now',
      text: 'none — headlines only',
      latest: { title: '8am ET, November 08 — the latest headlines from NPR', published: '2026-11-08', duration: 280 }
    },
    {
      showId: 135067274,
      name: 'Global News Podcast',
      publisher: 'BBC World Service',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/f1/4f/d1/f14fd1cf-7b5c-0bb7-683d-325c83bb089e/mza_17540730169954302156.jpg/600x600bb.jpg',
      feed: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss',
      source: 'https://feeds.bbci.co.uk/news/rss.xml',
      text: 'not checked',
      latest: { title: 'Poland in shock as six killed in shooting', published: '2026-11-08', duration: 1656 }
    },
    {
      showId: 1449631195,
      name: 'The Intelligence',
      publisher: 'The Economist',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/63/dd/cf/63ddcf01-0ea9-b6da-72f0-67fe5bba6ff7/mza_9059330379365777168.jpeg/600x600bb.jpg',
      feed: 'https://access.acast.com/rss/d556eb54-6160-4c85-95f4-47d9f5216c49',
      source: 'https://www.economist.com/podcasts/the-intelligence',
      text: 'not checked',
      latest: { title: '“Britain is back”: an interview with Andy Burnham', published: '2026-11-06', duration: 1572 }
    },
    {
      showId: 1346207297,
      name: 'Today, Explained',
      publisher: 'Vox',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/57/bc/e4/57bce477-b6e7-ba7d-5bca-6289f3f32e26/mza_17986217629149107841.jpeg/600x600bb.jpg',
      feed: 'https://feeds.megaphone.fm/VMP5705694065',
      source: 'https://www.vox.com/today-explained',
      text: 'not checked',
      latest: { title: 'Is intelligence overrated?', published: '2026-11-08', duration: 1823 }
    },
    {
      showId: 1469394914,
      name: 'The Journal.',
      publisher: 'The Wall Street Journal',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/91/0e/ca/910eca32-75a3-48b6-9be7-f45799ef5f2f/mza_9869666721903280546.jpg/600x600bb.jpg',
      feed: 'https://video-api.shdsvc.dowjones.io/api/podcasts/the%20journal/feed',
      source: 'https://www.wsj.com/podcasts/the-journal',
      text: 'not checked',
      latest: { title: 'The Russian officer secretly working for Ukraine', published: '2026-11-06', duration: 1757 }
    },
    {
      showId: 1640878689,
      name: 'The News Agents',
      publisher: 'Global',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/15/c9/9a/15c99a23-093f-ec33-11c7-1d0868ba0d2f/mza_11260062413365049894.jpg/600x600bb.jpg',
      feed: 'https://feeds.captivate.fm/the-news-agents/',
      source: 'https://www.globalplayer.com/podcasts/',
      text: 'not checked',
      latest: { title: 'Mehdi Hasan on Trump’s midterms disaster', published: '2026-11-06', duration: 2001 }
    },
    {
      showId: 1758855019,
      name: 'The Headlines',
      publisher: 'The New York Times',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/fc/8a/52/fc8a527d-8979-adf2-977b-06304a816969/mza_684749869280596722.jpg/600x600bb.jpg',
      feed: 'https://feeds.simplecast.com/ydACIPHO',
      source: 'https://www.nytimes.com/column/the-headlines',
      text: 'not checked',
      latest: {
        title: 'A data centre backlash in the midterms, and Melania Trump’s surprising diplomatic role',
        published: '2026-11-06',
        duration: 1004
      }
    },
    {
      showId: 136697472,
      name: 'Politics Weekly UK',
      publisher: 'The Guardian',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/5b/c3/68/5bc36828-cf61-c471-1e1a-629db43068e5/mza_4178671098091294109.jpg/600x600bb.jpg',
      feed: 'https://www.theguardian.com/politics/series/politicsweekly/podcast.xml',
      source: 'https://www.theguardian.com/politics/series/politicsweekly',
      text: 'not checked',
      latest: { title: 'Why Woke 2.0 is taking on Trump and establishment politics', published: '2026-11-07', duration: 3786 }
    },
    {
      showId: 356157099,
      name: 'Newshour',
      publisher: 'BBC World Service',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/60/6d/79/606d7992-2e59-3374-579f-83d3010f25bd/mza_15128963149149619329.jpg/600x600bb.jpg',
      feed: 'https://podcasts.files.bbci.co.uk/p002vsnk.rss',
      source: 'https://www.bbc.co.uk/programmes/p002vsnk',
      text: 'not checked',
      latest: { title: 'Heavy rain in Gaza floods tens of thousands of tents', published: '2026-11-07', duration: 2845 }
    }
  ],

  /* ── classic: one recording, one text, both named ──────────── */
  classic: {
    showId: 727850178,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    year: 1813,
    publisher: 'LibriVox',
    art: 'assets/art/cover-pride.jpg',
    artNote: 'Gutenberg #1342 cover, public domain',
    recording: { sections: 37, range: 'Chapters 1–61', total: 47203, host: 'archive.org', format: '64 kbps MP3' },
    text: { label: 'Gutenberg #1342', note: 'edition match open', url: 'https://www.gutenberg.org/ebooks/1342' },
    source: 'https://librivox.org/pride-and-prejudice-by-jane-austen/',
    feed: 'https://librivox.org/rss/253',
    chapters: [
      { index: '01', name: 'Chapters 1–3', duration: 1132 },
      { index: '02', name: 'Chapters 4–5', duration: 865 },
      { index: '03', name: 'Chapter 6', duration: 777 }
    ]
  },

  /* ── entertainment: no text layer, said plainly ────────────── */
  entertainment: [
    {
      showId: 1268527882,
      name: 'The Rewatchables',
      publisher: 'The Ringer',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/99/63/f5/9963f58d-1bc5-9bed-b1bb-254711ab4d6b/mza_11356609841155522187.jpg/600x600bb.jpg',
      feed: 'https://feeds.megaphone.fm/the-rewatchables',
      source: 'https://www.theringer.com/the-rewatchables',
      latest: { title: '“All the Right Moves” with Bill Simmons and Kyle Brandt', published: '2026-11-03', duration: 6579 }
    },
    {
      showId: 1092361338,
      name: 'Las Culturistas',
      publisher: 'Big Money Players · iHeart',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/25/2e/88/252e88df-e96e-a264-7a32-456dce4a36dd/mza_13164992107952038598.jpg/600x600bb.jpg',
      feed: 'https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/f6816727-c503-47ac-a7ac-ae2700391b1e/935c500f-8bb0-436b-ba7f-ae2700391b49/podcast.rss',
      source: 'https://www.iheart.com/podcast/1119-las-culturistas-with-mat-30289076/',
      latest: { title: '“Love That (Nah)” with Matt and Bowen', published: '2026-11-06', duration: 3912 }
    },
    {
      showId: 1439252196,
      name: 'The Big Picture',
      publisher: 'The Ringer',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/1d/81/33/1d813395-fa0e-b76a-4bb9-e04730707f3f/mza_12669351877858891723.jpeg/600x600bb.jpg',
      feed: 'https://feeds.megaphone.fm/the-big-picture',
      source: 'https://www.theringer.com/the-big-picture',
      latest: { title: '“Wild Horse Nine” is a hilarious American tragedy', published: '2026-11-06', duration: 6379 }
    },
    {
      showId: 278974813,
      name: 'Pop Culture Happy Hour',
      publisher: 'NPR',
      art: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/29/ca/0b/29ca0bf1-aa5b-3da8-9be0-f357793116a7/mza_16337213754400532987.jpg/600x600bb.jpg',
      feed: 'https://feeds.npr.org/510282/podcast.xml',
      source: 'https://www.npr.org/podcasts/510282/pop-culture-happy-hour',
      latest: { title: 'Wild Horse Nine and What’s Making Us Happy', published: '2026-11-06', duration: 1384 }
    }
  ],

  /* ── held back, and why ────────────────────────────────────── */
  held: [
    { name: 'Post Reports · The Washington Post', why: 'Latest item is a trailer, not an episode.' },
    { name: 'Lit2Go · Tom Sawyer', why: 'Recording licence unconfirmed.' },
    { name: 'VOA Learning English', why: 'Feed stops at 31 Mar 2025.' },
    { name: 'Mirrors and auto-transcripts', why: 'No named publisher.' }
  ]
};
