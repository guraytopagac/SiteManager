import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import TransactionDocument from "./TransactionDocument";
import pdfCss from "./transactionPdf.css?raw";

const TITLES = {
  income: "Tahsilat Makbuzu",
  expense: "Gider Pusulası",
};

function renderBody(props) {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => {
    root.render(createElement(TransactionDocument, props));
  });
  const body = container.innerHTML;
  root.unmount();
  return body;
}

export function buildTransactionDocumentHtml({ type, data, buildingName, managerName }) {
  const body = renderBody({ type, data, buildingName, managerName });

  const titleTag = document.createElement("title");
  titleTag.textContent = `${buildingName} ${TITLES[type]}`;

  return [
    "<!doctype html>",
    '<html lang="tr"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    titleTag.outerHTML,
    `<style>${pdfCss}</style>`,
    `</head><body>${body}</body></html>`,
  ].join("");
}
