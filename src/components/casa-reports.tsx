"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import type { CasaCareReport } from "@/lib/casa-reports";
import { careReportView } from "@/lib/casa-report-view";
import { useCasaLocale } from "@/components/use-casa-locale";
import { casaFnsLocale, casaRelativeTime, type CasaLocale, type CasaTextKey } from "@/lib/casa-locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Verdict = CasaCareReport["verdict"];
type ChecklistRow = CasaCareReport["checklist"][number];
type Translate = (key: CasaTextKey, vars?: Record<string, string | number>) => string;
type OpenPhotos = (frames: Frame[], index: number) => void;
type Frame = { url: string; label: string };

const VERDICT_KEY: Record<Verdict, CasaTextKey> = {
  OK: "reports.ok",
  ATTENTION: "reports.attention",
  URGENT: "reports.urgent",
};

const VERDICT_LINE: Record<Verdict, CasaTextKey> = {
  OK: "reports.line.ok",
  ATTENTION: "reports.line.attention",
  URGENT: "reports.line.urgent",
};

const CHECK_KEY: Record<ChecklistRow["key"], CasaTextKey> = {
  DOORS: "reports.check.doors",
  WINDOWS: "reports.check.windows",
  MAIL: "reports.check.mail",
  AIR: "reports.check.air",
  WATER: "reports.check.water",
  LIGHTS: "reports.check.lights",
  WASTE: "reports.check.waste",
  EXTERIOR: "reports.check.exterior",
};

export function CasaReportsPane({ siteId }: { siteId: string }) {
  const [loaded, setLoaded] = useState<{ siteId: string; failed: boolean; items: CasaCareReport[] } | null>(null);
  const [viewer, setViewer] = useState<{ frames: Frame[]; index: number } | null>(null);
  const { locale, t } = useCasaLocale();

  useEffect(() => {
    const ac = new AbortController();
    void fetch(`/api/casa/${siteId}/reports`, { signal: ac.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("reports");
        const body = (await response.json()) as { reports: CasaCareReport[] };
        setLoaded({ siteId, failed: false, items: body.reports });
      })
      .catch((error: unknown) => {
        if (ac.signal.aborted) return;
        setLoaded({ siteId, failed: true, items: [] });
        console.error(error);
      });
    return () => ac.abort();
  }, [siteId]);

  const site = loaded?.siteId === siteId ? loaded : null;
  const status = site ? (site.failed ? "error" : "ready") : "loading";
  const items = site?.items ?? [];

  if (status === "error") {
    return (
      <div className="casa-pane">
        <h2>{t("reports.title")}</h2>
        <p className="casa-pane-lead">{t("reports.error")}</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="casa-pane">
        <h2>{t("reports.title")}</h2>
        <ReportSkeleton />
      </div>
    );
  }

  const [latest, ...earlier] = items;

  if (!latest) {
    return (
      <div className="casa-pane">
        <h2>{t("reports.title")}</h2>
        <p className="casa-pane-lead">{t("reports.emptyLead")}</p>
        <p className="casa-history-empty">{t("reports.empty")}</p>
      </div>
    );
  }

  const openPhotos: OpenPhotos = (frames, index) => setViewer({ frames, index });

  return (
    <div className="casa-pane">
      <h2>{t("reports.title")}</h2>
      <ReportSpread siteId={siteId} report={latest} locale={locale} t={t} onPhotos={openPhotos} />
      {earlier.length ? (
        <section className="casa-report-ledger">
          <h3 className="casa-rule">
            <span>{t("reports.earlier")}</span>
            <i aria-hidden="true" />
          </h3>
          <ol className="casa-report-rows">
            {earlier.map((report) => (
              <ReportRow
                key={report.id}
                siteId={siteId}
                report={report}
                locale={locale}
                t={t}
                onPhotos={openPhotos}
              />
            ))}
          </ol>
        </section>
      ) : null}
      {viewer ? (
        <ReportViewer
          frames={viewer.frames}
          index={viewer.index}
          t={t}
          onIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}

/** The newest visit reads as a signed document, not a card: verdict, proof, sign-off. */
function ReportSpread({
  siteId,
  report,
  locale,
  t,
  onPhotos,
}: {
  siteId: string;
  report: CasaCareReport;
  locale: CasaLocale;
  t: Translate;
  onPhotos: OpenPhotos;
}) {
  const view = careReportView(report.checklist);
  const checked = view.remarks.length + view.covered.length;

  return (
    <article className="casa-report-spread" data-verdict={report.verdict}>
      <p className="casa-rule">
        <span>{t("reports.latest")}</span>
        <i aria-hidden="true" />
        <em>{casaRelativeTime(report.visitedAt, locale) ?? visitDay(report.visitedAt, locale)}</em>
      </p>

      <h3 className="casa-report-verdict">{t(VERDICT_LINE[report.verdict])}</h3>

      {report.summary ? <p className="casa-report-note">{report.summary}</p> : null}

      {view.flags.length ? (
        <ReportFlags siteId={siteId} reportId={report.id} flags={view.flags} t={t} onPhotos={onPhotos} />
      ) : null}

      {view.proofs.length ? (
        <section className="casa-report-sheet">
          <h4 className="casa-sr">{t("reports.proofs")}</h4>
          <ProofSheet
            frames={view.proofs.map((proof) => ({
              url: photoUrl(siteId, report.id, proof.id),
              label: t(CHECK_KEY[proof.key]),
            }))}
            lead={view.leadProof}
            t={t}
            onPhotos={onPhotos}
          />
        </section>
      ) : null}

      {checked ? (
        <section className="casa-report-coverage">
          <h4 className="casa-rule">
            <span>{t("reports.covered")}</span>
            <i aria-hidden="true" />
            <em>{checked === 1 ? t("reports.points.one") : t("reports.points.many", { n: checked })}</em>
          </h4>
          {view.remarks.length ? (
            <dl className="casa-report-remarks">
              {view.remarks.map((row) => (
                <div key={row.key}>
                  <dt>{t(CHECK_KEY[row.key])}</dt>
                  <dd>{row.note}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {view.covered.length ? (
            <ul className="casa-report-covered">
              {view.covered.map((row) => (
                <li key={row.key}>{t(CHECK_KEY[row.key])}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <footer className="casa-report-foot">
        {report.nextVisitAt ? (
          <p className="casa-report-next">
            <small>{t("reports.nextVisit")}</small>
            <time dateTime={report.nextVisitAt}>{visitDay(report.nextVisitAt, locale)}</time>
          </p>
        ) : null}
        <p className="casa-report-seal">
          <span className="casa-report-seal-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <path
                d="M14 51V27l18-16 18 16v24M25 51V36h14v15"
                stroke="currentColor"
                strokeWidth="4.4"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </svg>
          </span>
          <span className="casa-report-seal-body">
            <b>{t("reports.seal")}</b>
            <strong>{report.visitedByName}</strong>
            <time dateTime={report.visitedAt}>{visitDay(report.visitedAt, locale, true)}</time>
          </span>
        </p>
      </footer>
    </article>
  );
}

function ReportFlags({
  siteId,
  reportId,
  flags,
  t,
  onPhotos,
}: {
  siteId: string;
  reportId: string;
  flags: ChecklistRow[];
  t: Translate;
  onPhotos: OpenPhotos;
}) {
  return (
    <section className="casa-report-flagset">
      <h4 className="casa-rule">
        <span>{t("reports.flags")}</span>
        <i aria-hidden="true" />
      </h4>
      <ul className="casa-report-flags">
        {flags.map((row) => {
          const label = t(CHECK_KEY[row.key]);
          const frames = row.photos.map((photo) => ({ url: photoUrl(siteId, reportId, photo.id), label }));
          return (
            <li key={row.key}>
              <p className="casa-report-flag-head">
                <strong>{label}</strong>
                <em>{t("reports.check.attention")}</em>
              </p>
              {row.note ? <p className="casa-report-flag-note">{row.note}</p> : null}
              {frames.length ? <ProofSheet frames={frames} evidence t={t} onPhotos={onPhotos} /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A contact sheet of the visit. Which point a frame belongs to is named in the viewer.
 * Inside a flag the same frames drop to thumbnails, so the note stays the loudest thing.
 */
function ProofSheet({
  frames,
  lead = false,
  evidence = false,
  t,
  onPhotos,
}: {
  frames: Frame[];
  lead?: boolean;
  evidence?: boolean;
  t: Translate;
  onPhotos: OpenPhotos;
}) {
  return (
    <ul className={`casa-report-proofs${evidence ? " is-evidence" : lead ? " has-lead" : ""}`}>
      {frames.map((frame, index) => (
        <li key={frame.url}>
          <button
            type="button"
            onClick={() => onPhotos(frames, index)}
            aria-label={t("reports.photoAlt", { item: frame.label })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame.url} alt="" loading="lazy" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Earlier visits stay a ruled ledger: one line each, opening in place. */
function ReportRow({
  siteId,
  report,
  locale,
  t,
  onPhotos,
}: {
  siteId: string;
  report: CasaCareReport;
  locale: CasaLocale;
  t: Translate;
  onPhotos: OpenPhotos;
}) {
  const view = careReportView(report.checklist);
  const hasBody = Boolean(report.summary) || report.checklist.length > 0;

  return (
    <li>
      <Collapsible className="casa-report-row" data-verdict={report.verdict}>
        <CollapsibleTrigger className="casa-report-row-head" disabled={!hasBody}>
          <time className="casa-report-row-day" dateTime={report.visitedAt}>
            {ledgerDay(report.visitedAt, locale)}
          </time>
          <span className="casa-report-row-copy">
            <strong>{t(VERDICT_KEY[report.verdict])}</strong>
            <small>{t("reports.by", { name: report.visitedByName })}</small>
          </span>
          {hasBody ? (
            <>
              <span className="casa-report-row-meta">
                {rowMeta(report.checklist.length, view.photoCount, t)}
              </span>
              <i className="casa-report-row-chevron" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="m4.5 6 3.5 3.5L11.5 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  />
                </svg>
              </i>
            </>
          ) : null}
        </CollapsibleTrigger>
        {hasBody ? (
          <CollapsibleContent className="casa-report-row-panel" hiddenUntilFound>
            <div className="casa-report-row-body">
              {report.summary ? <p className="casa-report-note">{report.summary}</p> : null}
              {view.flags.length ? (
                <ReportFlags siteId={siteId} reportId={report.id} flags={view.flags} t={t} onPhotos={onPhotos} />
              ) : null}
              {view.proofs.length ? (
                <ProofSheet
                  frames={view.proofs.map((proof) => ({
                    url: photoUrl(siteId, report.id, proof.id),
                    label: t(CHECK_KEY[proof.key]),
                  }))}
                  evidence
                  t={t}
                  onPhotos={onPhotos}
                />
              ) : null}
              {view.remarks.length ? (
                <dl className="casa-report-remarks">
                  {view.remarks.map((row) => (
                    <div key={row.key}>
                      <dt>{t(CHECK_KEY[row.key])}</dt>
                      <dd>{row.note}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {view.covered.length ? (
                <ul className="casa-report-covered">
                  {view.covered.map((row) => (
                    <li key={row.key}>{t(CHECK_KEY[row.key])}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    </li>
  );
}

function ReportViewer({
  frames,
  index,
  t,
  onIndex,
  onClose,
}: {
  frames: Frame[];
  index: number;
  t: Translate;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const frame = frames[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % frames.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + frames.length) % frames.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndex, frames.length]);

  if (!frame || typeof document === "undefined") return null;
  const alt = t("reports.photoAlt", { item: frame.label });

  return createPortal(
    <div className="casa-report-viewer" role="dialog" aria-modal="true" aria-label={alt}>
      <button
        type="button"
        className="casa-report-viewer-scrim"
        onClick={onClose}
        aria-label={t("reports.closePhoto")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frame.url} alt={alt} />
      <p className="casa-report-viewer-caption">
        <span>{frame.label}</span>
        {frames.length > 1 ? <b>{`${index + 1}/${frames.length}`}</b> : null}
      </p>
      {frames.length > 1 ? (
        <>
          <button
            type="button"
            className="casa-report-viewer-nav is-prev"
            onClick={() => onIndex((index - 1 + frames.length) % frames.length)}
            aria-label={t("reports.photoPrev")}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
            </svg>
          </button>
          <button
            type="button"
            className="casa-report-viewer-nav is-next"
            onClick={() => onIndex((index + 1) % frames.length)}
            aria-label={t("reports.photoNext")}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
            </svg>
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="casa-report-viewer-close"
        onClick={onClose}
        aria-label={t("reports.closePhoto")}
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m6 6 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

function ReportSkeleton() {
  return (
    <div className="casa-report-skel" aria-hidden="true">
      <i className="casa-report-skel-rule" />
      <i className="casa-report-skel-line" />
      <i className="casa-report-skel-line is-short" />
      <i className="casa-report-skel-text" />
      <i className="casa-report-skel-text is-short" />
      <div className="casa-report-skel-sheet">
        <i />
        <i />
      </div>
    </div>
  );
}

function photoUrl(siteId: string, reportId: string, photoId: string) {
  return `/api/casa/${siteId}/reports/${reportId}/photos/${photoId}`;
}

function rowMeta(points: number, photos: number, t: Translate) {
  const point = points === 1 ? t("reports.points.one") : t("reports.points.many", { n: points });
  if (!photos) return point;
  const photo = photos === 1 ? t("reports.photos.one") : t("reports.photos.many", { n: photos });
  return `${point} · ${photo}`;
}

function visitDay(value: string, locale: CasaLocale, exact = false, now = new Date()) {
  const date = new Date(value);
  const withYear = exact || date.getFullYear() !== now.getFullYear();
  const pattern = locale === "pt" ? (withYear ? "d 'de' MMMM 'de' yyyy" : "d 'de' MMMM") : withYear ? "d MMMM yyyy" : "d MMMM";
  return format(date, pattern, { locale: casaFnsLocale(locale) });
}

function ledgerDay(value: string, locale: CasaLocale, now = new Date()) {
  const date = new Date(value);
  const pattern = date.getFullYear() === now.getFullYear() ? "d MMM" : "d MMM yy";
  return format(date, pattern, { locale: casaFnsLocale(locale) });
}
