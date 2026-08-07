# Current System Baseline

This document describes the supplied OAV Musiguda LMS Pro v2 frontend as imported. It is descriptive only; it does not propose or apply redesigns, fixes, refactoring, or migration work.

## A. Current application identity

The document title is `OAV MUSIGUDA LMS Pro v2 - Library Management System`. The sidebar brand is `OAV MUSIGUDA LMS v2`. The recovered source is one monolithic HTML document containing the application markup, CSS, and client-side JavaScript.

## B. Current navigation and views

The hash-based sidebar navigation exposes these views:

- Dashboard (`#dashboard`)
- Books Inventory (`#books`)
- Members Directory (`#members`)
- Issue Books (`#issue`)
- Return Books (`#return`)
- Reports & Analytics (`#reports`)
- Global Search (`#search`)
- System Settings (`#settings`)

The frontend switches `.view-section` elements and updates the page title as navigation changes. The mobile layout includes a collapsible sidebar and overlay.

## C. Frontend architecture

The implementation is a single HTML file with inline CSS and multiple inline JavaScript blocks. It uses a shared `window.LMS` object and module-like namespaces. The observed namespaces are `LMS.Common`, `LMS.Dashboard`, `LMS.Books`, `LMS.Members`, `LMS.Issue`, `LMS.Return`, `LMS.Reports`, `LMS.Search`, and `LMS.Settings`.

The source contains shared loading, toast, modal, navigation, theme, pagination, filtering, form, rendering, CSV export, and print behaviors. It includes a fallback path that logs a simulated server call when `google.script.run` is unavailable; this baseline does not change that behavior.

## D. Major JavaScript modules and namespaces

- `LMS.Common`: server-call wrapper, loaders, toast notifications, modal controls, navigation, theme, and HTML escaping.
- `LMS.Dashboard`: dashboard data loading, metrics, recent activity, and quick-add actions.
- `LMS.Books`: inventory loading, filtering, pagination, book form rendering, save, edit, and delete flows.
- `LMS.Members`: directory loading, filtering, pagination, member form rendering, save, edit, and status changes.
- `LMS.Issue`: active-member and available-book selection, due-date calculation, and issue submission.
- `LMS.Return`: issued-transaction loading/filtering, return selection, fine calculation, and return submission.
- `LMS.Reports`: circulation, overdue, popular-books, and member-activity report generation, CSV export, and printing.
- `LMS.Search`: global search execution and result rendering for books, members, and transactions.
- `LMS.Settings`: settings loading/saving, data synchronization, and connection testing.

## E. Google Apps Script integration

The client calls Google Apps Script through `google.script.run`, using success and failure handlers and a `withSuccessHandler` / `withFailureHandler` chain. The wrapper checks whether `google.script.run` is available before attempting calls. No standalone backend implementation is present in this repository baseline.

## F. Server function names referenced by the client

Direct `LMS.Common.callServer` calls observed in the client are:

`apiGetCurrentUser`, `apiGlobalSearch`, `deleteBook`, `getBooks`, `getDashboardData`, `getMembers`, `getSettings`, `getTransactions`, `issueBook`, `pingServer`, `returnBook`, `saveBook`, `saveMember`, `saveSettings`, and `syncAllData`.

The Apps Script initialization payload also exposes these names: `doGet`, `include`, `pingServer`, `apiGetCurrentUser`, `getDashboardData`, `getBooks`, `saveBook`, `deleteBook`, `getMembers`, `saveMember`, `deleteMember`, `getTransactions`, `issueBook`, `returnBook`, `getSettings`, `saveSettings`, `syncAllData`, `getSettingsInternal`, `getSheetDataAsObjects`, `getOrCreateSheet`, `generateUniqueId`, and `setupDatabaseSchema`.

These names are references observed in the supplied frontend/runtime wrapper only. No server-side `.gs` source was supplied or invented.

## G. Current forms

The source contains seven form surfaces:

- Dashboard quick-add book: title, author, ISBN, category, and copies quantity.
- Dashboard quick-add member: full name, email, phone, and member type.
- Books inventory modal: book title, author, ISBN, category, and total copies; edit and delete actions are also present.
- Members directory modal: full name, email, phone, member type, and account status.
- Issue Books: active member, available book, loan duration, calculated due date, and optional remarks/internal notes.
- Return Books: selected transaction, calculated fine amount, fine status, and return notes.
- System Settings: library name, contact email, contact phone, default loan period, maximum items per member, daily overdue fine, and grace period.

## H. Current tables and data views

The dashboard has metrics and a recent-activity table. Books Inventory displays Book ID, Title, Author, ISBN, Category, copies-related values, and Status. Members Directory displays Member ID, Name, Email, Phone, Type, Status, and Registered Date. Return Books displays transaction ID, book title, member name, due date, and status.

Global Search renders separate result tables for books, members, and transactions. Reports uses a dynamically populated table. Tables use horizontally scrollable responsive wrappers.

## I. Current report types

The report selector exposes:

- Circulation History Log
- Overdue Books & Fines
- Most Popular Books
- Member Activity Summary

Reports support start/end date controls, an Apply Filter action, print output, CSV export, and three summary metrics. The source includes report builders named `buildCirculationReport`, `buildOverdueReport`, `buildPopularReport`, and `buildMemberActivityReport`.

## J. Theme and responsive behavior

The body starts with a light theme and uses CSS custom properties for colors, spacing dimensions, shadows, and transition speed. A dark theme is represented by `body.theme-dark`; the client includes theme initialization and switching. At widths up to 768px the sidebar becomes off-canvas and the main wrapper loses its sidebar margin. At widths up to 480px the quick-search bar is hidden and the footer stacks vertically. There are fade-in, slide-in, and spinner animations in the supplied CSS.

## K. Known dependencies

The frontend loads Google Material Icons through Google Fonts. It also relies on browser-provided APIs and the Google Apps Script HTML-service runtime, including `google.script.run` when hosted in Apps Script.

## L. External resources loaded

The visible HTML declares the Google Material Icons stylesheet at `https://fonts.googleapis.com/icon?family=Material&#43;Icons`. The Apps Script-hosted wrapper in the supplied HAR also references Google-hosted Apps Script runtime resources, but the HAR itself is not preserved in the repository.

## M. Current data fields referenced

Observed book fields include `BookID`, `Title`, `Author`, `ISBN`, `Category`, `TotalCopies`, and `AvailableCopies`. Observed member fields include `MemberID`, `Name`, `Email`, `Phone`, `Type`, `Department`, `Status`, and `RegistrationDate`. Observed transaction fields include `TransactionID`, `BookID`/`BookTitle`, `MemberID`/`MemberName`, `IssueDate`, `DueDate`, `ReturnDate`, `Status`, `FineAmount`, and fine status/notes values. Settings fields include `LibraryName`, `ContactEmail`, `ContactPhone`, `DefaultLoanDays`, `MaxCheckoutLimit`, `DailyFineRate`, and `GracePeriodDays`.

## N. Current settings exposed in the UI

The settings view exposes library identity/contact values and circulation policy values: default loan period, maximum items per member, daily overdue fine, and grace period. The view also exposes Reset Changes, Save Settings, Sync Database, and Test Connection actions.

## Observed Issues / Future Investigation

The following are observations from the supplied source and are intentionally not corrected here:

- The recovered frontend references server functions, but the original server-side Apps Script source was not supplied.
- The client-side Apps Script initialization function list and the direct client call list are not identical; for example, `apiGlobalSearch` is called by the client but is not listed in the captured initialization function list.
- The interface contains mixed currency labels in the supplied source, including dollar-formatted fine labels and rupee-formatted report metrics.
- The HTML includes a local fallback path for environments where `google.script.run` is unavailable, so behavior outside Apps Script is not equivalent to the hosted deployment.

These observations are recorded for a later phase only. No application behavior was changed during baseline import.
