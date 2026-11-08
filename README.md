# DIAL

English listening library front-end. Four parts on the home page: current affairs, one classic
recording with its text, entertainment, and a closing page.

Static site — no build step. Open `index.html`, or serve the folder:

```
node server.mjs 8770     # any static server works
```

Content lives in `content.js` and is limited to entries whose publisher, official feed and the
specific episode have been checked. `held` lists what was rejected and why.
