'use client';
import { useState } from 'react';

const reportData = [
    { date: '12-Apr', agentsWorked: 2, boothsCovered: 2, votersMet: 2, whatsappSent: 0, smsSent: 0, slipsPrinted: 0, locationCaptured: 2, A: 1, B: 0, C: 0, NA: 1, total: 2 },
    { date: '13-Apr', agentsWorked: 5, boothsCovered: 4, votersMet: 8, whatsappSent: 3, smsSent: 2, slipsPrinted: 4, locationCaptured: 8, A: 2, B: 1, C: 1, NA: 4, total: 8 },
    { date: '14-Apr', agentsWorked: 8, boothsCovered: 7, votersMet: 15, whatsappSent: 6, smsSent: 4, slipsPrinted: 10, locationCaptured: 15, A: 5, B: 2, C: 1, NA: 7, total: 15 },
    { date: '15-Apr', agentsWorked: 10, boothsCovered: 9, votersMet: 20, whatsappSent: 12, smsSent: 5, slipsPrinted: 18, locationCaptured: 20, A: 8, B: 4, C: 2, NA: 6, total: 20 },
    { date: '16-Apr', agentsWorked: 12, boothsCovered: 11, votersMet: 25, whatsappSent: 14, smsSent: 8, slipsPrinted: 20, locationCaptured: 25, A: 10, B: 5, C: 3, NA: 7, total: 25 },
    { date: '17-Apr', agentsWorked: 14, boothsCovered: 13, votersMet: 30, whatsappSent: 16, smsSent: 10, slipsPrinted: 25, locationCaptured: 30, A: 12, B: 6, C: 4, NA: 8, total: 30 },
    { date: '18-Apr', agentsWorked: 16, boothsCovered: 15, votersMet: 35, whatsappSent: 20, smsSent: 12, slipsPrinted: 28, locationCaptured: 35, A: 15, B: 7, C: 5, NA: 8, total: 35 },
    { date: '19-Apr', agentsWorked: 18, boothsCovered: 17, votersMet: 40, whatsappSent: 22, smsSent: 15, slipsPrinted: 30, locationCaptured: 40, A: 18, B: 8, C: 6, NA: 8, total: 40 },
    { date: '20-Apr', agentsWorked: 20, boothsCovered: 19, votersMet: 50, whatsappSent: 25, smsSent: 18, slipsPrinted: 35, locationCaptured: 50, A: 22, B: 10, C: 8, NA: 10, total: 50 },
    { date: '21-Apr', agentsWorked: 22, boothsCovered: 21, votersMet: 55, whatsappSent: 28, smsSent: 20, slipsPrinted: 40, locationCaptured: 55, A: 25, B: 12, C: 10, NA: 8, total: 55 },
];

const wardData = [
    { ward: 'Ward 1', agents: 15, booths: 12, votersMet: 1200, A: 450, B: 100, C: 50, NA: 600, total: 1200 },
    { ward: 'Ward 2', agents: 18, booths: 15, votersMet: 1400, A: 500, B: 120, C: 60, NA: 720, total: 1400 },
    { ward: 'Ward 3', agents: 12, booths: 10, votersMet: 1000, A: 400, B: 80, C: 40, NA: 480, total: 1000 },
    { ward: 'Ward 4', agents: 20, booths: 16, votersMet: 1500, A: 550, B: 100, C: 50, NA: 800, total: 1500 },
    { ward: 'Ward 5', agents: 14, booths: 11, votersMet: 1100, A: 420, B: 90, C: 40, NA: 550, total: 1100 },
    { ward: 'Ward 6', agents: 16, booths: 13, votersMet: 1300, A: 480, B: 110, C: 60, NA: 650, total: 1300 },
    { ward: 'Ward 7', agents: 10, booths: 9, votersMet: 900, A: 350, B: 70, C: 40, NA: 440, total: 900 },
    { ward: 'Ward 8', agents: 22, booths: 18, votersMet: 1600, A: 600, B: 120, C: 80, NA: 800, total: 1600 },
    { ward: 'Ward 9', agents: 19, booths: 15, votersMet: 1450, A: 550, B: 100, C: 70, NA: 730, total: 1450 },
    { ward: 'Ward 10', agents: 13, booths: 10, votersMet: 1100, A: 400, B: 90, C: 60, NA: 550, total: 1100 },
];

const boothData = [
    { boothNo: 'Booth 101', agents: 2, votersMet: 150, whatsapp: 50, sms: 20, A: 60, B: 10, C: 5, NA: 75, total: 150 },
    { boothNo: 'Booth 102', agents: 3, votersMet: 180, whatsapp: 70, sms: 30, A: 80, B: 15, C: 10, NA: 75, total: 180 },
    { boothNo: 'Booth 103', agents: 2, votersMet: 120, whatsapp: 40, sms: 20, A: 50, B: 10, C: 5, NA: 55, total: 120 },
    { boothNo: 'Booth 104', agents: 4, votersMet: 200, whatsapp: 80, sms: 40, A: 90, B: 20, C: 10, NA: 80, total: 200 },
    { boothNo: 'Booth 105', agents: 3, votersMet: 170, whatsapp: 60, sms: 30, A: 70, B: 15, C: 10, NA: 75, total: 170 },
    { boothNo: 'Booth 106', agents: 2, votersMet: 130, whatsapp: 50, sms: 20, A: 60, B: 10, C: 5, NA: 55, total: 130 },
    { boothNo: 'Booth 107', agents: 3, votersMet: 160, whatsapp: 60, sms: 25, A: 70, B: 15, C: 10, NA: 65, total: 160 },
    { boothNo: 'Booth 108', agents: 2, votersMet: 140, whatsapp: 50, sms: 20, A: 60, B: 10, C: 5, NA: 65, total: 140 },
    { boothNo: 'Booth 109', agents: 3, votersMet: 180, whatsapp: 70, sms: 30, A: 80, B: 15, C: 10, NA: 75, total: 180 },
    { boothNo: 'Booth 110', agents: 4, votersMet: 210, whatsapp: 80, sms: 40, A: 100, B: 20, C: 10, NA: 80, total: 210 },
];

function ReportHeader({ assemblyNo, assemblyName, asOnDate }) {
    return (
        <div className="mb-4 border border-gray-400 bg-white">
            {/* Top Row */}
            <div className="flex justify-between items-center px-4 py-2 bg-orange-200 border-b border-gray-400">
                <div className="font-bold text-lg">
                    {assemblyNo} : {assemblyName}
                </div>

                <div className="flex gap-2 items-center">
                    <span className="font-semibold">As on Date</span>
                    <span className="bg-yellow-300 px-3 py-1 font-bold border border-gray-500">
                        {asOnDate}
                    </span>
                </div>
            </div>

            {/* Title Row */}
            <div className="text-center font-bold py-2 bg-gray-100">
                VOTER APP DATE WISE SUMMARY REPORT
            </div>
        </div>
    );
}



function CollapsibleSection({ title, onDownload, children }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="mb-6 bg-white rounded-lg shadow">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-200"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-2">
                    <span
                        className={`transition-transform duration-200 ${open ? 'rotate-90' : ''
                            }`}
                    >
                        ▶
                    </span>
                    <h2 className="font-bold text-lg">{title}</h2>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDownload();
                    }}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                    Download
                </button>
            </div>

            {/* Content */}
            {open && <div className="p-4">{children}</div>}
        </div>
    );
}


function downloadCSV(data, filename) {
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
        headers.map(h => `"${row[h]}"`).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}


function SimpleTable({ headers, columns, data }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <thead className="bg-blue-500">
                    <tr>
                        {headers.map((col) => (
                            <th
                                key={col}
                                className="px-3 py-2 text-center font-medium text-white"
                            >
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {data.map((row, i) => (
                        <tr
                            key={i}
                            className={i % 2 === 0 ? "bg-blue-50" : "bg-white"}
                        >
                            {columns.map((col) => (
                                <td key={col} className="px-3 py-2 text-center">
                                    {row[col]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}



export default function ReportsPage() {
    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <h1 className="text-2xl font-bold mb-6">
                Voter App Summary Reports
            </h1>

            {/* DATE WISE */}
            <CollapsibleSection
                title="Date Wise Summary"
                onDownload={() => downloadCSV(reportData, 'date-wise-report.csv')}
            >
                <SimpleTable
                    headers={[
                        'Date',
                        'Agents Worked',
                        'Booths Covered',
                        'Voters Met',
                        'Whatsapp Sent',
                        'SMS Sent',
                        'Slips Printed',
                        'Location Captured',
                        'A (Favour)',
                        'B (Non-Favour)',
                        'C (Neutral)',
                        "NA (Can't say)",
                        'Total',
                    ]}
                    columns={[
                        'date',
                        'agentsWorked',
                        'boothsCovered',
                        'votersMet',
                        'whatsappSent',
                        'smsSent',
                        'slipsPrinted',
                        'locationCaptured',
                        'A',
                        'B',
                        'C',
                        'NA',
                        'total',
                    ]}
                    data={reportData}
                />
            </CollapsibleSection>

            {/* WARD WISE */}
            <CollapsibleSection
                title="Ward Wise Summary"
                onDownload={() => downloadCSV(wardData, 'ward-wise-report.csv')}
            >
                <SimpleTable
                    headers={[
                        'Ward',
                        'Agents',
                        'Booths',
                        'Voters Met',
                        'A (Favour)',
                        'B (Non-Favour)',
                        'C (Neutral)',
                        "NA (Can't say)",
                        'Total',
                    ]}
                    columns={[
                        'ward',
                        'agents',
                        'booths',
                        'votersMet',
                        'A',
                        'B',
                        'C',
                        'NA',
                        'total',
                    ]}
                    data={wardData}
                />
            </CollapsibleSection>

            {/* BOOTH WISE */}
            <CollapsibleSection
                title="Booth Wise Summary"
                onDownload={() => downloadCSV(boothData, 'booth-wise-report.csv')}
            >
                <SimpleTable
                    headers={[
                        'Booth No.',
                        'Agents',
                        'Voters Met',
                        'Whatsapp',
                        'SMS',
                        'A (Favour)',
                        'B (Non-Favour)',
                        'C (Neutral)',
                        "NA (Can't say)",
                        'Total',
                    ]}
                    columns={[
                        'boothNo',
                        'agents',
                        'votersMet',
                        'whatsapp',
                        'sms',
                        'A',
                        'B',
                        'C',
                        'NA',
                        'total',
                    ]}
                    data={boothData}
                />
            </CollapsibleSection>
        </div>
    );
}

