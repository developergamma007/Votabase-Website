import GenderProgressBars from "../components/VoterChart";
import GenderStatCard from "../components/StatCard";

export default function Page() {
  const voters = {
    total: 12450,
    male: 6400,
    female: 5800,
    others: 250,
  };

  const data = [
    { label: "Male", value: voters.male, color: "bg-blue-500" },
    { label: "Female", value: voters.female, color: "bg-pink-500" },
    { label: "Others", value: voters.others, color: "bg-purple-500" },
  ];

  return (
    <div className="premium-grid">
      <section className="premium-hero">
        <p className="eyebrow">Overview</p>
        <h2 className="top-title">Voter Intelligence Dashboard</h2>
        <p className="text-slate-600">
          A cleaner premium dashboard shell for the existing reporting views.
        </p>
      </section>

      <section className="stats-grid">
        <div className="premium-card">
          <GenderStatCard data={data} total={voters.total} />
        </div>
        <div className="premium-card">
          <GenderProgressBars data={data} total={voters.total} />
        </div>
      </section>
    </div>
  );
}
