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
    {
      label: "Male",
      value: voters.male,
      color: "bg-blue-500",
    },
    {
      label: "Female",
      value: voters.female,
      color: "bg-pink-500",
    },
    {
      label: "Others",
      value: voters.others,
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <GenderStatCard data={data} total={voters.total} />
      <GenderProgressBars data={data} total={voters.total} />
    </div>
  );
}
