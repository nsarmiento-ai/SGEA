import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipment, Loan } from '../types';
import { formatDate } from './utils';

export const generateLoanPDF = (loan: Loan, equipments: Equipment[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('SGEA - Comprobante de Préstamo', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Escuela de Cine, Video y TV (UNT)', pageWidth / 2, 28, { align: 'center' });

  // Loan Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Folio: ${loan.id.slice(0, 8).toUpperCase()}`, 20, 45);
  doc.text(`Fecha de Salida: ${formatDate(loan.fecha_salida)}`, 20, 52);
  doc.text(`Responsable de Turno: ${loan.responsable_nombre}`, 20, 59);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Alumno: ${loan.alumno_nombre} (DNI: ${loan.alumno_dni})`, 20, 70);
  doc.text(`Materia: ${loan.materia || 'N/A'}`, 20, 77);
  doc.text(`Docente Responsable: ${loan.docente_responsable || 'N/A'}`, 20, 84);
  doc.text(`Devolución Estimada: ${formatDate(loan.fecha_devolucion_estimada)}`, 20, 91);

  // Equipment Table
  const tableData: any[][] = [];
  let counter = 1;

  equipments.forEach(eq => {
    // Main equipment row
    tableData.push([
      counter++,
      eq.nombre,
      eq.modelo,
      eq.numero_serie,
      eq.categoria
    ]);

    // Pieces rows
    if (eq.piezas && eq.piezas.length > 0) {
      eq.piezas.forEach(pieza => {
        tableData.push([
          '',
          `   • ${pieza.nombre} (${pieza.estado})`,
          '',
          '',
          ''
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: 98,
    head: [['#', 'Equipo / Kit', 'Modelo', 'Nº Serie', 'Categoría']],
    body: tableData,
    headStyles: { fillColor: [245, 158, 11] }, // Amber 500
    theme: 'grid',
    styles: { cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' }
    }
  });

  // Footer / Signatures
  const finalY = (doc as any).lastAutoTable.finalY + 30;
  
  doc.line(20, finalY, 80, finalY);
  doc.text('Firma Responsable', 35, finalY + 5);

  doc.line(pageWidth - 80, finalY, pageWidth - 20, finalY);
  doc.text('Firma Alumno', pageWidth - 65, finalY + 5);

  // Save
  doc.save(`prestamo_${loan.alumno_nombre.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

export const generateReservationPDF = (reservation: any, equipments: Equipment[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('SGEA - Comprobante de Reserva', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Escuela de Cine, Video y TV (UNT)', pageWidth / 2, 28, { align: 'center' });

  // Reservation Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Docente: ${reservation.docente_nombre}`, 20, 45);
  doc.text(`Materia: ${reservation.materia || 'N/A'}`, 20, 52);
  doc.text(`Fecha Desde: ${formatDate(reservation.fecha_inicio)}`, 20, 59);
  doc.text(`Fecha Hasta: ${formatDate(reservation.fecha_fin)}`, 20, 66);
  doc.text(`Estado: ${reservation.estado.toUpperCase()}`, 20, 73);

  // Equipment Table
  const tableData = equipments.map((eq, index) => [
    index + 1,
    eq.nombre,
    eq.modelo,
    eq.categoria
  ]);

  autoTable(doc, {
    startY: 82,
    head: [['#', 'Equipo', 'Modelo', 'Categoría']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42] },
    theme: 'grid',
  });

  // Save
  doc.save(`reserva_${reservation.docente_nombre.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

export const generateReturnPDF = (loan: Loan, equipments: Equipment[], responsableRecibe: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('SGEA - Comprobante de Devolución', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Escuela de Cine, Video y TV (UNT)', pageWidth / 2, 28, { align: 'center' });

  // Return Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Folio Préstamo: ${loan.id.slice(0, 8).toUpperCase()}`, 20, 45);
  doc.text(`Fecha de Devolución: ${formatDate(new Date().toISOString())}`, 20, 52);
  doc.text(`Recibido por: ${responsableRecibe}`, 20, 59);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Alumno: ${loan.alumno_nombre} (DNI: ${loan.alumno_dni})`, 20, 70);

  // Equipment Table
  const tableData = equipments.map((eq, index) => {
    let status = 'RECIBIDO OK';
    if (eq.piezas && eq.piezas.length > 0) {
      const issues = eq.piezas.filter(p => p.estado !== 'OK').map(p => `${p.nombre}: ${p.estado}`);
      if (issues.length > 0) {
        status = `CON INCIDENCIAS:\n${issues.join('\n')}`;
      }
    }
    return [
      index + 1,
      eq.nombre,
      eq.modelo,
      eq.numero_serie,
      status
    ];
  });

  autoTable(doc, {
    startY: 80,
    head: [['#', 'Equipo', 'Modelo', 'Nº Serie', 'Estado al Recibir']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42] },
    theme: 'grid',
  });

  // Signature
  const finalY = (doc as any).lastAutoTable.finalY + 30;
  doc.line(pageWidth / 2 - 30, finalY, pageWidth / 2 + 30, finalY);
  doc.text('Firma Digital Pañolero', pageWidth / 2, finalY + 5, { align: 'center' });
  doc.setFontSize(8);
  doc.text(responsableRecibe, pageWidth / 2, finalY + 10, { align: 'center' });

  // Save
  doc.save(`devolucion_${loan.alumno_nombre.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};
