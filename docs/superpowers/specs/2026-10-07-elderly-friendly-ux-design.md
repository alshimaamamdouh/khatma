# Elderly-Friendly Khatma UX — Design

Date: 2026-10-07
Status: Approved after review changes (server-side ownership, double-tap safety, tile wording, admin-password handling)

## Goal

People aged 68–80 must be able to join, read, and mark their juz — and organizers must be
able to create and manage a khatma — without anyone explaining the website to them.
The site should feel like opening a WhatsApp message, not like software.

## Users and tasks

All of these are done by elderly users:

1. Open a shared link and see their juz.
2. Mark their juz as finished (and undo by mistake).
3. Quick khatma: pick a free juz and register their name.
4. Create a khatma and manage it (names, deceased, pause, settings).

Assumed device: a phone, opening links from WhatsApp.

## Design principles (apply to every screen)

- Body text ≥ 20px; juz number and person names much larger (juz number ~3rem).
- Buttons ≥ 56px tall; the primary action is full width.
- One primary action per screen; secondary actions visually quieter.
- Strong contrast. Status is never color-only: always text + icon (e.g. "✅ أنهى", "⏳ لم ينته بعد").
- Every button has a text label; no icon-only buttons.
- Plain Arabic. Banned words in the UI: CSV, شاغر, التكرار, رمز, كلمة مرور (except in the legacy code entry and legacy login, section 6).
- Every action ends in a clear confirmation message.
- Every destructive or reversing action asks "هل أنت متأكد…؟ [نعم، …] [لا]" first.
- Arabic-Indic digits (١٢) for juz numbers and counts.
- Header: khatma site name only. Dark-mode toggle and header navigation removed
  (the stored dark-mode preference is cleared so nobody is stuck in dark mode).

## Links

| Link | Who | Opens |
|---|---|---|
| `/k/<code>` | everyone | the khatma, no code typing |
| `/m/<code>#<password>` | organizer | the manage menu |

- `<code>` is URL-encoded (old khatmas may have Arabic codes).
- The password is in the URL fragment (`#`) so it never reaches server logs.
- The admin password must never appear in application logs, analytics events,
  server request logs, error reports, or any URL sent to the backend. It travels only
  in the `x-admin-password` header. The client reads it from the fragment, stores it,
  then removes the fragment with `history.replaceState` so it is not left in the address bar.
  Server code must not log request headers or bodies of admin routes.
- Opening either link stores code/id (and password for `/m`) on the phone, so the
  same phone later goes straight in from the home page.
- New khatmas: the client generates the access code (8 random lowercase letters/digits,
  no look-alikes) and admin password (24 random chars) with `crypto.getRandomValues`.
  On a 409 "code already used" response, regenerate and retry once.

## 1. Participant — regular khatma

**First visit (no participant remembered for this khatma):**

- Title: "مَن أنت؟ اضغط على اسمك"
- One large button per name.
- Tap → confirm: "هل أنت محمد أحمد؟ [نعم] [لا]".
- "نعم" claims the name on the server (section 5) and stores the participant id and
  token **per khatma** on the phone.

**Main screen:** the juz card is the strongest visual element on the page — it is
what the person opened the link to find. The greeting is smaller above it; the two
actions sit directly under it.

```
السلام عليكم يا محمد 🌷
جزؤك الحالي
الجزء ١٢
(يتغير الجزء يوم الأحد ١٢ أكتوبر)      ← only if not daily and not paused
[ 📖 ابدأ قراءة الجزء ]                 ← opens quran.com/ar/juz/12 in a new tab
[ ✅ أنهيت قراءة الجزء ]
```

- While a request is in flight, the button shows "جاري التسجيل…" and is disabled, so a
  second tap does nothing.
- After "أنهيت": the action buttons are replaced by
  "جزاك الله خيرًا 🌷 — تم تسجيل أنك أنهيت الجزء ١٢." and a small "تراجع" link.
- "تراجع" → "هل تريد التراجع عن تسجيل القراءة؟ [نعم، تراجع] [لا]".
- Below: dedication in one sentence —
  "هذه الختمة إهداءً إلى روح المرحوم أحمد محمد، رحمه الله." (multiple names joined with " و ").
- Progress sentence: "١٢ من ٣٠ شخصًا أنهوا القراءة" (plus the existing progress bar).
- Collapsed "عرض المشاركين ▼": view-only list, one row per person:
  "الجزء ١٢ — محمد أحمد — ✅ أنهى" / "⏳ لم ينته بعد". No buttons.
- Paused khatma: a calm banner "الختمة متوقفة مؤقتًا حتى <date>" replaces the juz card.
- All finished: the existing celebration banner + Du'a al-Khatm.
- Footer (small, secondary):
  - "لست محمد؟ غيّر الاسم" → clears the remembered participant → name list.
  - "تحتاج مساعدة؟ تواصل مع منظم الختمة" → `wa.me/<organizer_phone>`; shown only
    if the organizer saved a phone number.

## 2. Participant — quick khatma

- No remembered participant: list of juz as large rows.
  - Free: "الجزء ٥ — متاح [اختر هذا الجزء]".
  - Taken: "الجزء ٦ — محمد ✅/⏳" (no button).
- "اختر هذا الجزء" → one screen: "اكتب اسمك" (large input) + "[تأكيد]" + "[رجوع]".
- On success the new participant id is remembered and they land on the **same main
  screen** as section 1. If the juz was just taken (409): "هذا الجزء أخذه شخص آخر،
  اختر جزءًا آخر" and the list refreshes.
- A remembered quick-khatma participant sees the main screen; "غيّر الاسم" returns to the list.

## 3. Creating a khatma

- Entry: home page button "إنشاء ختمة جديدة".
- Step 1 — two large cards:
  - "كل شخص يختار جزءه بنفسه" (quick)
  - "أنا أكتب الأسماء، والأجزاء تتغير كل فترة" (regular)
- Step 2 — form:
  - "اسم الختمة" (required)
  - Regular only: "متى تتغير الأجزاء؟" — large radio rows: كل يوم / كل أسبوع (default) /
    كل أسبوعين / كل شهر. Start date = today (hidden).
  - "رقم واتساب للمساعدة (اختياري)" with hint "ليتواصل معك المشاركون إذا احتاجوا مساعدة".
  - Folded "خيارات إضافية": start date, custom number of days, Hijri dates, starting khatma number.
- Success screen:
  - "تم إنشاء الختمة بنجاح 🌷"
  - Regular: "الخطوة التالية: أضف أسماء المشاركين" → [أضف الأسماء] (opens Names screen).
  - [🟢 أرسل الختمة للعائلة على واتساب] — message with name + `/k/<code>` link.
  - [🔒 احفظ رابط الإدارة عندك على واتساب] — wa.me message containing `/m/<code>#<password>`
    and the line "احتفظ بهذه الرسالة، ولا ترسلها لأحد".
  - The phone is remembered as organizer.

## 4. Managing (organizer only)

Reached by the `/m/...` link, by "إدارة الختمة" on the participant screen (shown only
on the organizer's phone), or by the legacy login.

**Menu of large tiles:**

| Tile | Screen |
|---|---|
| الأسماء | add one / add many (one per line), edit, reorder (large ▲▼ with text), delete with confirmation |
| الإهداء للمتوفين | add one / add many, edit, delete with confirmation |
| تسجيل من أنهى القراءة | all participants with status; organizer can mark/unmark anyone (with confirmation for unmark) |
| إرسال للعائلة | send khatma link; send reminder to those who haven't finished; share full distribution |
| إيقاف مؤقت | pause from/to, resume |
| الإعدادات | name, change schedule, Hijri, starting number, help phone; "خيارات متقدمة": download Excel file (the CSV), copy khatma, delete khatma (double confirmation) |
| السجل والإحصائيات | existing History and Stats pages |

- Every sub-screen has a large "رجوع" button back to the menu.
- A "عرض الختمة كما يراها المشاركون" link returns to the participant view.
- Quick khatmas hide tiles that don't apply (الإهداء, إيقاف مؤقت, السجل والإحصائيات, schedule settings).

## 5. Permissions

- Participants: see own juz, mark/undo **own** juz, view progress and the list.
- Organizer: everything, including marking others.
- Enforcement is applied both in the UI and in the backend. The UI prevents accidental
  changes; the backend guarantees that participants can only update their own reading
  status. Organizers can update any participant.
- Mechanism — participant token:
  - Each participant has a random `token` (server-generated, created lazily).
  - Confirming a name ("نعم") or joining a quick khatma calls the server, which returns
    that participant's token; the phone stores it per khatma.
  - Mark/undo requests must carry either `x-participant-token` matching the
    `participantId` in the body, or a valid `x-admin-password` for the khatma.
    Otherwise the server responds 403.
  - Honest limit: anyone with the khatma link can claim a name (there are no accounts),
    so this guards against old clients, UI bugs and casual tampering — not a determined
    attacker. That matches the goal.
- Old clients that do not send a token are rejected for mark/undo; they get the new
  client on next load, and a phone with a remembered name but no token is sent back to
  "مَن أنت؟" once to claim it.

## 6. Old khatmas (backward compatibility)

- Home page keeps "عندك رمز الختمة؟ اكتبه هنا" (code entry) for people who received an old code.
- Manage: "دخول بالرمز وكلمة المرور" as a small link → legacy login form.
- Old localStorage keys (`khatmaCode`, `khatmaId`, `adminPassword`, `participantId`) keep working;
  the global `participantId` is migrated to the per-khatma key on first load.
- `/khatma/:id/dashboard`, `/admin/manage`, `/admin/create` routes redirect to their new equivalents.

## Backend changes (small)

- `Khatma` model: add `organizer_phone: { type: String, default: null }`.
- `POST /khatma` and `PUT /khatma/:id`: accept `organizerPhone` (digits only, stored normalized).
- `Participant` model: add `token: { type: String, default: null }` (never returned in
  participant lists or the dashboard).
- `POST /khatma/:id/participants/:pid/claim` (auth: khatma code): returns the
  participant's token, generating it with `crypto.randomBytes` if missing.
- `POST /khatma/:id/join`: also returns the new participant's token.
- `POST` / `DELETE /khatma/:id/completions`: require the participant token or admin
  password (see section 5). Both are idempotent: marking an already-finished juz returns
  200 with the current counts (no 409); undoing an unfinished juz returns 200.
- `GET /khatma/:id/dashboard`: add `organizer_phone` and `nextChangeDate`
  (`start + (floor(daysSinceStart / cycleDays) + 1) * cycleDays`, `null` if daily, quick, or paused).
- Server never logs request headers or bodies (no request-logging middleware is added).

## Code structure

- `client/src/utils/storage.js` — all localStorage reads/writes (per-khatma keys, migration).
- `client/src/utils/links.js` — build/parse share and manage links, WhatsApp URLs, code/password generation.
- `client/src/utils/arabicNumbers.js` — Arabic-Indic digit formatting.
- `client/src/components/ConfirmDialog.jsx` — the shared "هل أنت متأكد؟" dialog.
- Participant: `pages/KhatmaPage.jsx` (route `/k/:code`), decides between
  `components/WhoAreYou.jsx`, `components/QuickJuzPicker.jsx`, `components/MyJuzCard.jsx`.
- Organizer: `pages/manage/ManageMenu.jsx` plus one file per tile under `pages/manage/`,
  replacing the 870-line `ManageKhatma.jsx`.
- `index.css`: raise base sizes, add large-button / large-row / tile styles; remove unused styles.

## Testing

- Local backend + `mongodb-memory-server` (dev-only) — never the production database.
- Server: `node:test` tests for `nextChangeDate`, `organizer_phone`, ownership
  (own token ✓, other participant's token ✗ 403, no token ✗ 403, admin password ✓),
  and idempotency (marking twice → one completion record, both 200; undo twice → 200).
- Rapidly tapping the same action multiple times must produce exactly one state change
  (Playwright: triple-click "أنهيت قراءة الجزء" → one completion, success message once).
- UI: Playwright at 390×844 (phone) walking each flow — create regular, add names,
  participant pick name → finish → undo; create quick → pick juz; old-code login; manage link —
  with screenshots reviewed for size, wording, and RTL layout.
- `vite build` must pass.

## Out of scope

- An in-site Quran reader (we keep linking to quran.com, Arabic UI).
- Notifications / reminders sent automatically.
