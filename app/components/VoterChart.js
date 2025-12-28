
export default function GenderProgressBars({ data, total }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold mb-6">
        Gender Overview
      </h3>

      <div className="space-y-5">
        {data.map((item) => {
          const percent = ((item.value / total) * 100).toFixed(1);

          return (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">
                    {item.label}
                  </span>
                  <span className="text-gray-500">
                    {item.value} ({percent}%)
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`${item.color} h-3 rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
          );
        })}
      </div>
    </div>
  );
}



