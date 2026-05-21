var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/components/ApplicationList.jsx
var ApplicationList_exports = {};
__export(ApplicationList_exports, {
  default: () => ApplicationList_default
});
module.exports = __toCommonJS(ApplicationList_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString(void 0, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
function isToday(isoString) {
  if (!isoString) return false;
  const date = new Date(isoString);
  const now = /* @__PURE__ */ new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
function TrackerMetrics({ applications }) {
  const applied = applications.filter((app) => app && app.status === "applied");
  const total = applied.length;
  const today = applied.filter((app) => isToday(app.appliedAt)).length;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "grid grid-cols-2 gap-1.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-lg font-semibold text-slate-800", children: total }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-xs text-slate-500", children: "Total" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-lg font-semibold text-emerald-600", children: today }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-xs text-slate-500", children: "Today" })
    ] })
  ] });
}
function EmptyState() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-col items-center gap-1.5 py-8 text-center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg", children: "\u{1F4CB}" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-sm font-medium text-slate-600", children: "No applications yet" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-xs text-slate-400", children: "Applications will appear here after you autofill a form." })
  ] });
}
function ApplicationItem({ application, onDelete }) {
  const [confirming, setConfirming] = (0, import_react.useState)(false);
  const handleDeleteClick = (0, import_react.useCallback)(() => {
    if (confirming) {
      onDelete(application.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3e3);
    }
  }, [confirming, application.id, onDelete]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "group flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "truncate text-sm font-medium text-slate-800", children: application.role || "Untitled Role" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "truncate text-xs text-slate-500", children: application.company || "Unknown Company" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "text-xs text-slate-400", children: formatDate(application.appliedAt) }),
        application.url && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "text-xs text-slate-300", children: "\xB7" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "a",
            {
              className: "truncate text-xs text-blue-500 hover:text-blue-600 hover:underline",
              href: application.url,
              rel: "noopener noreferrer",
              target: "_blank",
              title: application.url,
              children: "View posting"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            className: `rounded-full px-2 py-0.5 text-[10px] font-semibold ${application.status === "applied" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`,
            children: application.status === "applied" ? "Applied" : "Draft"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        "aria-label": confirming ? "Confirm delete" : "Delete application",
        className: `mt-0.5 shrink-0 rounded px-1 py-0.5 text-xs font-medium transition-all ${confirming ? "bg-red-50 text-red-600 opacity-100 hover:bg-red-100" : "text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"}`,
        onClick: handleDeleteClick,
        type: "button",
        children: confirming ? "Sure?" : "\u2715"
      }
    )
  ] });
}
function ApplicationList({ applications, error, isLoading, onDelete }) {
  if (isLoading) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "py-4 text-center text-sm text-slate-500", children: "Loading..." });
  }
  if (error) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "py-4 text-center text-sm font-medium text-red-600", children: error });
  }
  if (applications.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {});
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "grid gap-2.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrackerMetrics, { applications }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grid gap-1.5", children: applications.map((app) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ApplicationItem,
      {
        application: app,
        onDelete
      },
      app.id
    )) })
  ] });
}
var ApplicationList_default = ApplicationList;
