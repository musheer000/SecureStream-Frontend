import { useEffect, useState } from "react";
import { api } from "./api";
import { FileText, Download, Play, Shield } from "lucide-react";

interface Report {
  id: number;
  periodEnd?: any;
  createdAt?: string;
  totalThreats: number;
  criticalThreats: number;
  highThreats: number;
  filePath: string;
}

export default function ReportsView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await api.get("/reports");
      setReports(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/reports/generate");
      fetchReports();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (id: number) => {
    const token = localStorage.getItem("securestream_access");
    fetch(`http://localhost:8080/api/v1/reports/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Report_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(console.error);
  };

  const formatDate = (r: Report): string => {
    if (r.createdAt) return new Date(r.createdAt).toLocaleDateString();
    if (r.periodEnd) {
      if (Array.isArray(r.periodEnd)) {
        return new Date(r.periodEnd[0], r.periodEnd[1] - 1, r.periodEnd[2]).toLocaleDateString();
      }
      return new Date(r.periodEnd).toLocaleDateString();
    }
    return "—";
  };

  return (
    <div style={{ padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileText size={24} color="#06b6d4" />
          <h2 style={{ margin: 0, fontSize: 18, color: "#e2e8f0" }}>Threat Intelligence Reports</h2>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
            color: "#fff", padding: "8px 16px", borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
            border: "none", boxShadow: "0 4px 15px rgba(6,182,212,0.3)"
          }}
        >
          {generating ? <Shield size={16} /> : <Play size={16} />}
          {generating ? "Compiling..." : "Generate Daily Report"}
        </button>
      </div>

      <div style={{
        background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
        border: "1px solid rgba(56,189,248,0.12)", borderRadius: 14, overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: 20, color: "#94a3b8" }}>Loading reports...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
                {["Date", "Total Threats", "Critical", "High", "Action"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid rgba(56,189,248,0.05)" }}>
                  <td style={{ padding: "12px 14px", color: "#e2e8f0", fontSize: 13 }}>{formatDate(r)}</td>
                  <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 13 }}>{r.totalThreats ?? 0}</td>
                  <td style={{ padding: "12px 14px", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{r.criticalThreats ?? 0}</td>
                  <td style={{ padding: "12px 14px", color: "#f97316", fontSize: 13, fontWeight: 600 }}>{r.highThreats ?? 0}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => handleDownload(r.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "rgba(56,189,248,0.1)",
                        border: "1px solid rgba(56,189,248,0.3)",
                        color: "#38bdf8", padding: "4px 10px", borderRadius: 6,
                        fontSize: 11, fontWeight: 600, cursor: "pointer"
                      }}
                    >
                      <Download size={12} /> Download PDF
                    </button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    No reports generated yet. Click "Generate Daily Report" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
