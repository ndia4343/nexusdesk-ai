"use client";

import React from "react";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

// Parses inline markdown tokens: bold (**text**, __text__), italic (*text*, _text_),
// inline code (`code`), and markdown links ([text](url)).
// Guarantees literal "**" asterisks never appear.
const parseInline = (text: string): React.ReactNode[] => {
  if (!text) return [];

  // Normalize __bold__ to **bold**
  let normalized = text.replace(/__([^_]+?)__/g, "**$1**");

  // Regex matching:
  // 1: ***bold italic***
  // 2: **bold**
  // 3: *italic* (requiring non-space after open asterisk)
  // 4: `code`
  // 5: [link](url)
  const pattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*(?!\s)[^*]+?\*|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      const raw = normalized.substring(lastIndex, match.index).replace(/\*\*/g, "");
      if (raw) nodes.push(raw);
    }

    const token = match[0];
    const key = `${match.index}_${token.length}`;

    if (token.startsWith("***") && token.endsWith("***") && token.length >= 6) {
      const inner = token.slice(3, -3);
      nodes.push(
        <strong key={key} className="font-semibold text-slate-900 dark:text-slate-100">
          <em className="italic">{parseInline(inner)}</em>
        </strong>
      );
    } else if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      const inner = token.slice(2, -2);
      nodes.push(
        <strong key={key} className="font-semibold text-slate-900 dark:text-slate-100">
          {inner}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      const inner = token.slice(1, -1);
      nodes.push(
        <em key={key} className="italic text-slate-900 dark:text-slate-200">
          {inner}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      const inner = token.slice(1, -1);
      nodes.push(
        <code
          key={key}
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-sky-700 dark:text-cyan font-semibold border border-slate-300 dark:border-slate-700"
        >
          {inner}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 dark:text-cyan font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token.replace(/\*\*/g, ""));
    }

    lastIndex = pattern.lastIndex;
  }

  // Push remaining string, cleaning any orphaned or unmatched **
  if (lastIndex < normalized.length) {
    const remaining = normalized.substring(lastIndex).replace(/\*\*/g, "");
    if (remaining) nodes.push(remaining);
  }

  return nodes;
};

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: { num: string; text: string }[] }
  | { type: "p"; lines: string[] };

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content, className = "" }) => {
  if (!content) return null;

  const rawLines = content.split("\n");
  const blocks: Block[] = [];
  let currentList: { type: "ul"; items: string[] } | { type: "ol"; items: { num: string; text: string }[] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      blocks.push({ type: "p", lines: [...currentParagraphLines] });
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Empty line -> separates paragraphs / lists
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Header 3
    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", text: trimmed.replace(/^###\s+/, "") });
      continue;
    }

    // Header 2
    if (/^##\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") });
      continue;
    }

    // Header 1
    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h1", text: trimmed.replace(/^#\s+/, "") });
      continue;
    }

    // Unordered bullet list: starts with "-", "*", or "•"
    const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered numbered list: starts with "1.", "2.", etc.
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push({ num: olMatch[1], text: olMatch[2] });
      continue;
    }

    // Otherwise standard paragraph line
    flushList();
    currentParagraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === "h1") {
          return (
            <h1 key={bIdx} className="text-base font-bold text-slate-900 dark:text-slate-100 pt-2 pb-1">
              {parseInline(block.text)}
            </h1>
          );
        }

        if (block.type === "h2") {
          return (
            <h2 key={bIdx} className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-1.5 pb-0.5">
              {parseInline(block.text)}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3 key={bIdx} className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider pt-1 pb-0.5">
              {parseInline(block.text)}
            </h3>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={bIdx} className="space-y-1.5 my-1.5">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="flex items-start gap-2">
                  <span className="text-sky-600 dark:text-cyan font-bold select-none mt-0.5 leading-none">•</span>
                  <span className="flex-1">{parseInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={bIdx} className="space-y-1.5 my-1.5">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="flex items-start gap-2">
                  <span className="font-mono text-xs font-bold text-sky-600 dark:text-cyan select-none mt-0.5 min-w-[18px]">
                    {item.num}.
                  </span>
                  <span className="flex-1">{parseInline(item.text)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "p") {
          return (
            <p key={bIdx} className="leading-relaxed">
              {block.lines.map((line, lIdx) => (
                <React.Fragment key={lIdx}>
                  {lIdx > 0 && <br />}
                  {parseInline(line)}
                </React.Fragment>
              ))}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
};
