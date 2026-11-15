"use client";

import { useState } from "react";

export function CodeBlock({ code, lang, title, note }: { code: string; lang?: string; title?: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  return (
    <figure className="code">
      <figcaption>
        <span className="code-title">{title ?? "snippet"}</span>
        {lang && <span className="code-lang">{lang}</span>}
        <button className="code-copy" onClick={copy} aria-label="Copy code">
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      {note && <p className="code-note">{note}</p>}
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

type Block =
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "code"; lang: string; code: string };

function parse(body: string): Block[] {
  const lines = body.split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push({ t: "code", lang, code: buf.join("\n") });
    } else if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      out.push({ t: "ul", items });
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      out.push({ t: "ol", items });
    } else if (line.trim() === "") {
      i++;
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") && !/^- /.test(lines[i]) && !/^\d+\. /.test(lines[i])) buf.push(lines[i++]);
      out.push({ t: "p", text: buf.join(" ") });
    }
  }
  return out;
}

export function Rich({ body }: { body: string }) {
  return (
    <div className="rich">
      {parse(body).map((b, idx) => {
        if (b.t === "p") return <p key={idx}>{b.text}</p>;
        if (b.t === "ul") return <ul key={idx}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>;
        if (b.t === "ol") return <ol key={idx}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol>;
        return <CodeBlock key={idx} code={b.code} lang={b.lang} />;
      })}
    </div>
  );
}
