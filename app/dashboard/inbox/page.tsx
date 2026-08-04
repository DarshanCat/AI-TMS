import InboxForms from "./InboxForms";

export default function InboxPage() {
  return (
    <div>
      <h1 className="page-title">Inbox — batch entry</h1>
      <p className="page-sub">
        Pick a transaction type, fill the shared header once, add one row per tool, then post.
        Every row is validated by the engine before it writes to the ledger.
      </p>
      <InboxForms />
    </div>
  );
}