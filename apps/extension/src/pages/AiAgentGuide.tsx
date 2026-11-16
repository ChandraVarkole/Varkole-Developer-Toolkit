export function AiAgentGuide({ currentRecordId }: { currentRecordId?: string | undefined }) {
  return (
    <section className="ai-guide" aria-labelledby="ai-guide-title">
      <div className="ai-guide-hero">
        <div>
          <div className="eyebrow">Guide · capabilities · safeguards</div>
          <h2 id="ai-guide-title">How AI Agent works</h2>
          <p>
            AI Agent plans and performs read-only Salesforce lookups across the selected org using
            your current access, then asks your selected model to explain the retrieved evidence.
          </p>
        </div>
        <span className="badge badge-outline">Read only</span>
      </div>

      <div className={`ai-guide-record ${currentRecordId ? 'detected' : ''}`}>
        <strong>{currentRecordId ? 'Current record detected' : 'A record page is optional'}</strong>
        {currentRecordId ? (
          <p>
            You can ask about “this record” or “the current record.” Varkole will use the detected
            record ID and retrieve the fields your Salesforce user can access.
          </p>
        ) : (
          <p>
            You can ask about any record from anywhere. Include its 15- or 18-character Salesforce
            record ID for the most reliable result, or provide the object name and enough details to
            identify it. Without page context or an identifier, “this record” cannot be resolved.
          </p>
        )}
      </div>

      <div className="ai-guide-grid">
        <GuideCard title="What it can help with">
          <ul>
            <li>Find and summarize accessible records and related records.</li>
            <li>Run read-only counts, totals, averages, date filters, and grouped calculations.</li>
            <li>Explain accessible reports, dashboards, schema, permissions, and org limits.</li>
            <li>Inspect accessible Apex, triggers, Visualforce, Aura, LWC, Flows, and logs.</li>
            <li>Suggest SOQL, Flow designs, implementation steps, tests, and safer decisions.</li>
          </ul>
        </GuideCard>

        <GuideCard title="How each question runs">
          <ol>
            <li>Varkole reads relevant object and field metadata.</li>
            <li>The model proposes a minimal read-only lookup plan.</li>
            <li>Varkole validates and runs permitted Salesforce API requests.</li>
            <li>The model answers from the returned evidence, followed by an evidence check.</li>
          </ol>
          <p>
            Retrieval is not limited to the current page. Page context helps with phrases such as
            “this record,” but Varkole can inspect other accessible records, schema, automation,
            code, reports, dashboards, and permissions when the question requires them.
          </p>
        </GuideCard>

        <GuideCard title="Current safeguards">
          <ul>
            <li>Uses only the selected org and the current Salesforce user’s access.</li>
            <li>Never sends the Salesforce session token to the AI provider.</li>
            <li>Rejects writes, DML, deployments, and anonymous Apex execution.</li>
            <li>Treats Salesforce field values, source comments, and logs as untrusted data.</li>
            <li>Withholds answers that claim Salesforce facts without retrieved evidence.</li>
          </ul>
        </GuideCard>

        <GuideCard title="How request capacity works">
          <p>
            There is no fixed chat-turn cutoff. Varkole keeps the visible browser-session chat and
            automatically carries the most relevant recent history and retained Salesforce evidence
            into each request. It performs targeted retrieval instead of downloading the entire org.
          </p>
          <ul>
            <li>Automatic lookups can retrieve up to 2,000 records across ten query pages.</li>
            <li>Requests can carry about 150,000 characters of grounded Salesforce evidence.</li>
            <li>
              Answers can request up to 8,000 output tokens when the selected provider allows it.
            </li>
            <li>The provider model’s own context, rate, quota, and billing limits still apply.</li>
          </ul>
        </GuideCard>

        <GuideCard title="What it cannot guarantee">
          <ul>
            <li>It cannot bypass object, field, record, setup, package, or API permissions.</li>
            <li>It cannot read protected managed-package source.</li>
            <li>Large or broad requests can be partial and may require a narrower follow-up.</li>
            <li>The selected model can choose an incomplete plan or misunderstand a request.</li>
            <li>AI output can be incorrect; verify important data and recommendations.</li>
          </ul>
        </GuideCard>

        <GuideCard title="Ask better questions">
          <ul className="ai-guide-examples">
            <li>“Summarize record 001… and show its open Opportunities.”</li>
            <li>“How many active Cases were created this month, grouped by priority?”</li>
            <li>“Explain the accessible LWC named AccountHealth and its Apex calls.”</li>
            <li>“Design a record-triggered Flow for Case using the real fields in this org.”</li>
          </ul>
          <p>
            Exact record IDs, object API names, component names, filters, and date ranges produce
            the most reliable results. If a name matches several records, AI Agent may return the
            candidates instead of guessing.
          </p>
        </GuideCard>
      </div>

      <section className="ai-guide-language" aria-labelledby="lookup-language-title">
        <h3 id="lookup-language-title">How to read an answer</h3>
        <div>
          <span>
            <strong>Found</strong> A successful Salesforce lookup returned records.
          </span>
          <span>
            <strong>No matches</strong> A successful lookup returned zero records.
          </span>
          <span>
            <strong>Partial</strong> More data exists than Varkole retrieved or sent to the model.
          </span>
          <span>
            <strong>Not inspected</strong> The required lookup was not completed; this is not a
            permission denial or a zero result.
          </span>
        </div>
      </section>

      <p className="ai-guide-footer">
        Your question, recent chat context, and relevant accessible Salesforce results go directly
        to your selected AI provider after consent. Varkole does not operate an AI relay server or
        store the chat.
      </p>
    </section>
  );
}

function GuideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="ai-guide-card">
      <h3>{title}</h3>
      {children}
    </article>
  );
}
