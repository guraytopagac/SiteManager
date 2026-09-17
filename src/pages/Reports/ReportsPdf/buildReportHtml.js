// Renders the report and returns the whole page as one string for the main process. Only the footer's left
// text is built here, as a second one line rule that merges with the one in the stylesheet.

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import ReportDocument from "./ReportDocument";
import pdfCss from "./reportPdf.css?raw";

const footerCss = (title) =>
  `@page { @bottom-left { content: ${JSON.stringify(`Mavikent Site Yönetimi · ${title}`)}; } }`;

function renderBody(props) {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => {
    root.render(createElement(ReportDocument, props));
  });
  const body = container.innerHTML;
  root.unmount();
  return body;
}

export function buildReportHtml({ data, scope, year, month, buildingName, managerName }) {
  const title = `${scope.title(year, month)} Raporu`;
  const body = renderBody({ data, year, title, buildingName, managerName });

  const titleTag = document.createElement("title");
  titleTag.textContent = `${buildingName} ${title}`;

  return [
    "<!doctype html>",
    '<html lang="tr"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    titleTag.outerHTML,
    `<style>${pdfCss}${footerCss(title)}</style>`,
    `</head><body>${body}</body></html>`,
  ].join("");
}
