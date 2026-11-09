import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PayslipDetail = {
  id: string;
  component_code: string;
  quantity: number;
  unit_rate: number;
  amount: number;
  source_ref: string | null;
};

export type PayslipItem = {
  id: string;
  employee_id: string;
  full_name: string;
  employee_number: string | null;
  position_name: string | null;
  location_name: string | null;
  pay_group_name: string | null;
  period_start: string;
  period_end: string;
  payable_minutes: number;
  late_minutes: number;
  earnings_total: string | number;
  deduction_total: string | number;
  net_pay: string | number;
};

export function exportPayslipPdf(
  item: PayslipItem,
  details: PayslipDetail[],
  orgName = "Ayam Bakar Pucuk Singkong",
  orgTagline = "Sistem Informasi Manajemen & Penggajian Terpadu"
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const formatRupiah = (num: number | string) =>
    `Rp ${Number(num).toLocaleString("id-ID")}`;

  // Header Box
  doc.setFillColor(1, 102, 90); // Brand primary #01665a
  doc.rect(14, 12, pageWidth - 28, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(orgName.toUpperCase(), 20, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(230, 245, 240);
  doc.text(orgTagline, 20, 28);
  doc.text("SLIP GAJI KARYAWAN (CONFIDENTIAL)", pageWidth - 20, 25, { align: "right" });

  // Employee Information
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9.5);

  const startY = 44;
  doc.setFont("helvetica", "bold");
  doc.text("DATA KARYAWAN", 14, startY);
  doc.setFont("helvetica", "normal");

  const leftCol = [
    ["Nama Karyawan", `: ${item.full_name}`],
    ["No. Karyawan (CW)", `: ${item.employee_number || "-"}`],
    ["Jabatan / Lokasi", `: ${item.position_name || "-"} / ${item.location_name || "-"}`],
  ];

  const rightCol = [
    ["Kelompok Gaji", `: ${item.pay_group_name || "-"}`],
    ["Periode Kerja", `: ${item.period_start} s/d ${item.period_end}`],
    ["Total Hadir / Telat", `: ${Math.round(item.payable_minutes / 60)} Jam (${item.payable_minutes} mnt) / ${item.late_minutes} mnt`],
  ];

  let curY = startY + 6;
  for (let i = 0; i < leftCol.length; i++) {
    doc.text(leftCol[i][0], 14, curY);
    doc.text(leftCol[i][1], 52, curY);

    doc.text(rightCol[i][0], 115, curY);
    doc.text(rightCol[i][1], 155, curY);
    curY += 5.5;
  }

  // Pisahkan Earnings dan Deductions
  const earnings = details.filter((d) => Number(d.amount) >= 0);
  const deductions = details.filter((d) => Number(d.amount) < 0);

  const formatCode = (code: string) => {
    switch (code) {
      case "GAPOK":
        return "Gaji Pokok";
      case "TUNJ_KEHADIRAN":
        return "Tunjangan Kehadiran";
      case "TUNJ_TRANSPORT":
        return "Tunjangan Transportasi";
      case "TUNJ_JABATAN":
        return "Tunjangan Jabatan";
      case "UPAH_JAM":
        return "Upah Per Jam Hadir";
      case "UPAH_HARIAN":
        return "Upah Harian";
      case "INSENTIF_TGL_MERAH":
        return "Insentif Masuk Tanggal Merah";
      case "LEMBUR":
        return "Lembur";
      case "POTONGAN_TELAT":
        return "Potongan Denda Telat";
      case "KASBON":
        return "Cicilan / Potongan Kasbon";
      default:
        return code.replace(/_/g, " ");
    }
  };

  const tableBody: any[] = [];

  tableBody.push([{ content: "PENGHASILAN (EARNINGS)", colSpan: 4, styles: { fillColor: [240, 245, 245], fontStyle: "bold" } }]);
  if (earnings.length === 0) {
    tableBody.push(["-", "Tidak ada komponen penghasilan", "-", "Rp 0"]);
  } else {
    for (const e of earnings) {
      tableBody.push([
        formatCode(e.component_code),
        e.source_ref === "manual_override" ? `${e.component_code} (Manual Adjustment)` : e.component_code,
        e.quantity > 1 ? `${e.quantity} x ${formatRupiah(e.unit_rate)}` : "-",
        formatRupiah(e.amount),
      ]);
    }
  }

  tableBody.push([{ content: "POTONGAN (DEDUCTIONS)", colSpan: 4, styles: { fillColor: [255, 240, 240], fontStyle: "bold" } }]);
  if (deductions.length === 0) {
    tableBody.push(["-", "Tidak ada potongan", "-", "Rp 0"]);
  } else {
    for (const d of deductions) {
      tableBody.push([
        formatCode(d.component_code),
        d.source_ref === "manual_override" ? `${d.component_code} (Manual Adjustment)` : d.component_code,
        d.quantity > 1 ? `${d.quantity} x ${formatRupiah(d.unit_rate)}` : "-",
        formatRupiah(Math.abs(d.amount)),
      ]);
    }
  }

  autoTable(doc, {
    startY: curY + 4,
    head: [["Komponen Gaji", "Keterangan / Ref", "Qty / Satuan", "Nominal"]],
    body: tableBody as never,
    theme: "grid",
    headStyles: {
      fillColor: [1, 102, 90],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Summary Box
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(210, 215, 220);
  doc.rect(pageWidth - 95, finalY, 81, 28, "FD");

  doc.setFontSize(8.5);
  doc.text("Total Penghasilan", pageWidth - 90, finalY + 6);
  doc.text(formatRupiah(item.earnings_total), pageWidth - 18, finalY + 6, { align: "right" });

  doc.text("Total Potongan", pageWidth - 90, finalY + 13);
  doc.text(`- ${formatRupiah(item.deduction_total)}`, pageWidth - 18, finalY + 13, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(1, 102, 90);
  doc.text("GAJI BERSIH (NETTO)", pageWidth - 90, finalY + 22);
  doc.text(formatRupiah(item.net_pay), pageWidth - 18, finalY + 22, { align: "right" });

  // Tanda Tangan / Verifikasi
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  const signY = finalY + 38;
  doc.text("Dicetak secara otomatis oleh sistem", 14, signY);
  doc.text(`Waktu Cetak: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`, 14, signY + 5);

  doc.text("Karyawan Penerima,", pageWidth - 60, signY);
  doc.text(`( ${item.full_name} )`, pageWidth - 60, signY + 20);

  // Save / Open PDF in browser
  const filename = `Slip_Gaji_${item.full_name.replace(/\s+/g, "_")}_${item.period_end}.pdf`;
  doc.save(filename);
}
