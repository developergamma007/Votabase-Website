
export default function GenderStatCard({ data, total }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold mb-6">
        Gender Distribution
      </h3>
      <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100 mb-6">
        <p className="text-sm text-gray-500">Total Booths</p>
        <p className="text-xl font-semibold text-gray-900 mt-2 ">
          32
        </p>
      </div>
      <div className="space-y-5">
        {data.map((item) => {
          return (
            <>
              <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100">
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-xl font-semibold text-gray-900 mt-2">
                  {item.value}
                </p>
              </div>

            </>
          );
        })}
      </div>
    </div>
  );
}



