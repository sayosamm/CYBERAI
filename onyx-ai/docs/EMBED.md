# Add the AI chat to a client's website (1 line)

The Onyx chat widget drops onto **any** website — Wix, Squarespace, WordPress,
GoDaddy, a custom site — with a single line of code. It adds a floating chat
bubble that talks to that client's AI (answers questions, discloses it's AI,
offers a human) and captures **callback requests** (name + phone) straight into
the dashboard and the owner's notifications. No website rebuild.

## The snippet

Paste this just before the closing `</body>` tag of the client's site. Replace
the URL with that client's Onyx instance URL.

```html
<script src="https://THEIR-INSTANCE.onrender.com/widget.js"
        data-name="Acme Plumbing"
        data-accent="#1e73be"
        data-launch="Chat with us"></script>
```

| Attribute | What it does | Example |
|---|---|---|
| `src` | The client's Onyx instance (where the AI runs) | `https://acme.onrender.com/widget.js` |
| `data-name` | Title shown at the top of the chat | `Acme Plumbing` |
| `data-accent` | Brand color (hex) — matches their site | `#1e73be` |
| `data-launch` | Text on the chat button | `Chat with us` |

Only `src` is required; the rest have sensible defaults.

## Where to paste it (common platforms)
- **WordPress:** a "Custom HTML" block in the footer, or a header/footer-scripts
  plugin. (On WordPress.com you need a Business plan for custom scripts.)
- **Squarespace:** Settings → Advanced → Code Injection → Footer.
- **Wix:** Settings → Custom Code → Add Custom Code → Body end.
- **GoDaddy Website Builder:** add an HTML/embed section.
- **Custom site:** just before `</body>`.

## Preview it
Open **`/widget-demo.html`** on the instance (e.g.
`https://THEIR-INSTANCE.onrender.com/widget-demo.html`) — a mock site with the
widget already on it. Great for showing a prospect "here's your site with the
chat," without touching their real website.

## Notes
- The widget calls only the public chat + contact endpoints (CORS-enabled); it
  never exposes the dashboard.
- It becomes genuinely smart (answers almost anything) when the instance has
  `ANTHROPIC_API_KEY` set; otherwise it uses the built-in rule-based answers.
- The callback form respects consent and the same STOP/opt-out rules as the
  rest of the system.
- Don't have access to edit the client's site? Send them the one line — most
  owners (or their web person) can paste it in a minute.
