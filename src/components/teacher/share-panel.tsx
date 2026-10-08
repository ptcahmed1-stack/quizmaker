"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CopyButton, useCanShare, useOrigin } from "@/components/client-bits";
import { Button, Card, buttonClass } from "@/components/ui";

interface Props {
  code: string;
  title: string;
  subject: string;
  originFallback: string;
  justPublished: boolean;
}

export function SharePanel({ code, title, subject, originFallback, justPublished }: Props) {
  const origin = useOrigin(originFallback);
  const url = `${origin}/quiz/${code}`;
  const [qr, setQr] = useState<string | null>(null);
  const canShare = useCanShare();

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => setQr(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function share() {
    try {
      await navigator.share({ title: `${title} – Quiz`, text: `Take the quiz "${title}" here:`, url });
    } catch {
      /* user cancelled */
    }
  }

  function printQr() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) {
      window.alert("Please allow pop-ups to print the QR code.");
      return;
    }
    const safe = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
    w.document.write(`<!doctype html><html><head><title>${safe(title)} – QR Code</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#0f172a}h1{font-size:28px;margin:0 0 4px}p{margin:4px 0;font-size:16px;color:#334155}img{width:420px;max-width:80vw;margin:24px auto;display:block}.code{font-size:40px;font-weight:800;letter-spacing:.15em;margin-top:8px}.url{font-family:ui-monospace,monospace;font-size:14px;word-break:break-all}</style></head>
      <body><h1>${safe(title)}</h1>${subject ? `<p>${safe(subject)}</p>` : ""}<p>Scan the QR code with your phone camera to start the quiz</p>
      <img src="${qr}" alt="QR code" /><p class="code">${safe(code)}</p><p class="url">${safe(url)}</p>
      <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="p-6 lg:col-span-3">
        {justPublished && (
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-inset ring-emerald-200">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
            </span>
            <div>
              <p className="font-bold">Quiz Published Successfully</p>
              <p className="text-sm">Share this quiz with your students.</p>
            </div>
          </div>
        )}
        <h2 className="text-lg font-semibold text-slate-900">Student link</h2>
        <p className="mt-1 text-sm text-slate-600">Students can open this link directly from their phone. No app or account is needed.</p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="block break-all font-mono text-sm text-indigo-700 underline sm:text-base">{url}</a>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <CopyButton text={url} variant="primary" />
          <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("outline")}>Open Quiz</a>
          {canShare && <Button variant="outline" onClick={share}>Share…</Button>}
        </div>
        <div className="mt-6 rounded-xl bg-indigo-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Quiz code</p>
          <p className="mt-1 font-mono text-3xl font-extrabold tracking-[0.2em] text-indigo-900">{code}</p>
          <p className="mt-1 text-xs text-indigo-800">Students can also type this code on the QuizMaker home page.</p>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          Paste the link into WhatsApp, email, SMS, Google Classroom or any messaging app. The quiz loads instantly in the browser.
        </p>
      </Card>

      <Card className="flex flex-col items-center p-6 lg:col-span-2">
        <h2 className="self-start text-lg font-semibold text-slate-900">QR code</h2>
        <p className="mt-1 self-start text-sm text-slate-600">Display it on the board — students scan with their camera.</p>
        <div className="mt-4 flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code linking to ${url}`} className="h-full w-full" />
          ) : (
            <span className="text-sm text-slate-400">Generating…</span>
          )}
        </div>
        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <a href={qr ?? "#"} download={`quiz-${code}-qr.png`} aria-disabled={!qr} className={buttonClass("outline", "md", !qr ? "pointer-events-none opacity-50" : "")}>
            Download QR
          </a>
          <Button variant="outline" onClick={printQr} disabled={!qr}>Print QR</Button>
        </div>
      </Card>
    </div>
  );
}
