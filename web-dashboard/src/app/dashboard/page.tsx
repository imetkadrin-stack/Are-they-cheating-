"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Dashboard page – displays job controls, status, and latest logs.
//
// All API calls go through the Next.js server-side proxy at /api/proxy/...
// which injects the Azure Function host key from the server environment.
// The key is never exposed to the browser.
// ---------------------------------------------------------------------------

type Job = {
  job_id: string;
  status: string;
  submitted_at?: string;
  output?: string;
};

type LogEntry = {
  timestamp: string;
  message: string;
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runJob() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/jobs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered_from: "dashboard" }),
      });
      const data: Job = await res.json();
      setJobs((prev) => [data, ...prev]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/logs/latest");
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus(job_id: string) {
    try {
      const res = await fetch(`/api/proxy/jobs/status/${job_id}`);
      const updated: Job = await res.json();
      setJobs((prev) => prev.map((j) => (j.job_id === job_id ? { ...j, ...updated } : j)));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ color: "#38bdf8" }}>EricksonAtHome – Remote Admin Dashboard</h1>
      <p style={{ color: "#94a3b8" }}>
        Authenticated control plane for Azure-hosted automation jobs.
      </p>

      {error && (
        <div style={{ background: "#7f1d1d", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          ⚠ {error}
        </div>
      )}

      {/* Job Controls */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ color: "#7dd3fc" }}>Job Controls</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button onClick={runJob} disabled={loading} style={btnStyle("#0ea5e9")}>
            ▶ Run Job
          </button>
          <button onClick={fetchLogs} disabled={loading} style={btnStyle("#6366f1")}>
            📋 Fetch Latest Logs
          </button>
        </div>
      </section>

      {/* Job History */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ color: "#7dd3fc" }}>Job History</h2>
        {jobs.length === 0 ? (
          <p style={{ color: "#64748b" }}>No jobs submitted yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr>
                {["Job ID", "Status", "Submitted", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.job_id}>
                  <td style={tdStyle}><code>{j.job_id}</code></td>
                  <td style={tdStyle}><StatusBadge status={j.status} /></td>
                  <td style={tdStyle}>{j.submitted_at ?? "—"}</td>
                  <td style={tdStyle}>
                    <button onClick={() => checkStatus(j.job_id)} style={btnStyle("#0284c7", true)}>
                      Refresh
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Logs */}
      <section>
        <h2 style={{ color: "#7dd3fc" }}>Latest Logs</h2>
        {logs.length === 0 ? (
          <p style={{ color: "#64748b" }}>No logs fetched yet.</p>
        ) : (
          <pre style={{ background: "#1e293b", padding: "1rem", borderRadius: 6, overflowX: "auto", fontSize: "0.8rem" }}>
            {logs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n")}
          </pre>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "#fbbf24",
    running: "#60a5fa",
    completed: "#34d399",
    failed: "#f87171",
    unknown: "#94a3b8",
  };
  return <span style={{ color: colors[status] ?? "#94a3b8", fontWeight: 600 }}>{status}</span>;
}

function btnStyle(bg: string, small = false) {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: small ? "0.3rem 0.75rem" : "0.6rem 1.25rem",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: small ? "0.8rem" : "1rem",
  };
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  borderBottom: "1px solid #334155",
  color: "#94a3b8",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem",
  borderBottom: "1px solid #1e293b",
};
