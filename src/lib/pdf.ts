import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipment, Loan } from '../types';
import { formatDate } from './utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDateTime = (dateVal: any) => {
  if (!dateVal) return 'N/A';
  try {
    const date = typeof dateVal === 'string' ? parseISO(dateVal) : dateVal;
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
  } catch (e) {
    return String(dateVal);
  }
};

export const generateLoanPDF = (
  loan: any, 
  equipments: Equipment[], 
  docenteEmail?: string,
  authorizedIds: string[] | null = null
) => {
  console.log('=== [PDF Debug] INICIO GENERACIÓN PDF ===');
  console.log('1. Equipos a despachar:', equipments.map(e => ({ id: e.id, nombre: e.nombre })));
  console.log('2. Datos del préstamo:', loan);
  console.log('3. authorizedIds (argumento):', authorizedIds);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Robust detection of authorized items
  // Prefer metadata if available (from LoanWizard context), then authorizedIds argument
  const metadata = loan.metadata || {};
  const requestedIds = metadata.equipos_autorizados !== undefined 
    ? metadata.equipos_autorizados 
    : (loan.equipos_autorizados || authorizedIds);

  // A loan is "Direct" (all items OK) if there was no original student request or reservation to compare against
  const isDirectLoan = !requestedIds || 
    (requestedIds === null) || 
    (!metadata.authorized_by_request && !metadata.authorized_by_reservation && !authorizedIds && !loan.equipos_autorizados);

  console.log('4. requestedIds detectados:', requestedIds);
  console.log('5. ¿Es Préstamo Directo?:', isDirectLoan);
  console.log('5b. Debug Source:', { 
    authReq: metadata.authorized_by_request, 
    authRes: metadata.authorized_by_reservation, 
    argAuth: authorizedIds,
    loanAuth: loan.equipos_autorizados 
  });

  const dbAuthorized = (requestedIds || []).map((id: any) => String(id).trim().toLowerCase());
  console.log('6. dbAuthorized (normalizado):', dbAuthorized);
  
  // Teacher implicit approval: detected via marker in materia or state
  const isTeacherReserva = (loan.materia || '').includes('[Auto-Aval Docente]') || loan.estado === 'Avalada' || loan.estado === 'Aprobada';
  console.log('7. ¿Es Reserva de Docente?:', isTeacherReserva);

  // Header Icon/Logo (Simple Circle for logo)
  doc.setFillColor(245, 158, 11);
  doc.circle(20, 20, 5, 'F');
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('SGEA - Comprobante de Préstamo', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Escuela de Cine, Video y TV (UNT)', pageWidth / 2, 28, { align: 'center' });

  // Loan Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Nro de Operación: ${loan.id?.slice(0, 8).toUpperCase() || 'N/A'}`, 20, 45);
  doc.text(`Fecha: ${formatDate(loan.fecha_salida)}`, 20, 52);
  doc.text(`Responsable (Administrador): ${loan.responsable_nombre}`, 20, 59);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Docente: ${loan.docente_responsable || 'N/A'}`, 20, 70);
  doc.text(`Docente que Avala: ${loan.docente_aval_id || loan.docente_responsable || 'N/A'}`, 20, 77);
  doc.text(`Email Docente: ${docenteEmail || 'N/A'}`, 20, 84);
  doc.text(`Alumno: ${loan.alumno_nombre} (DNI: ${loan.alumno_dni})`, 20, 91);
  doc.text(`Materia: ${loan.materia || 'N/A'}`, 20, 98);
  doc.text(`Devolución Estimada: ${formatDateTime(loan.fecha_devolucion_estimada)}`, 20, 105);

  // Equipment Table
  const tableData: any[][] = [];
  let counter = 1;

  const nonAuthorizedNames: string[] = [];

  equipments.forEach(eq => {
    // 1. Extract the ID more robustly (check different possible field names)
    // Some components might pass objects with different key names for the ID
    const rawEqId = (eq as any).id || (eq as any).recurso_id || (eq as any).equipo_id || (eq as any).id_equipo || '';
    const itemId = String(rawEqId).trim().toLowerCase();
    
    // 2. Kit Check: If the item belongs to a kit, and the KIT was authorized, the item is authorized.
    const kitId = (eq as any).kit_id || (eq as any).pertenece_a_kit || null;
    const kitIdNormalized = kitId ? String(kitId).trim().toLowerCase() : null;

    // 3. Last resort: Name matching (if IDs are completely lost but name matches authorized list)
    // This is useful for edge cases where IDs might change but names are consistent
    // We'd need the names of authorized items, which we don't have easily here unless we fetch them
    
    const isOriginalItem = dbAuthorized.includes(itemId) || (kitIdNormalized && dbAuthorized.includes(kitIdNormalized));
    
    const isActuallyAuthorized = isDirectLoan || (isTeacherReserva && isOriginalItem) || isOriginalItem;
    
    // Debug Log as requested
    console.log('[PDF Debug] Item Check:', { 
      nombre: eq.nombre, 
      idEncontrado: itemId, 
      kitId: kitIdNormalized,
      estaEnListaOriginal: isOriginalItem, 
      autorizadoFinal: isActuallyAuthorized,
      listaAutorizados: dbAuthorized.slice(0, 5) // Show first 5 for brevity
    });

    if (!isActuallyAuthorized) nonAuthorizedNames.push(eq.nombre);
    
    // Main equipment row
    tableData.push([
      counter++,
      eq.nombre,
      eq.modelo || 'N/A',
      eq.numero_serie || 'N/A',
      isActuallyAuthorized ? 'AUTORIZADO' : 'AGREGADO EN DESPACHO'
    ]);

    // Pieces rows
    if (eq.piezas && eq.piezas.length > 0) {
      eq.piezas.forEach(pieza => {
        tableData.push([
          '',
          `   • ${pieza}`,
          '',
          '',
          ''
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: 112,
    head: [['#', 'Equipo / Kit', 'Modelo', 'Nº Serie', 'Estado Aval']],
    body: tableData,
    headStyles: { fillColor: [245, 158, 11] }, // Amber 500
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        if (data.cell.text[0] === 'AGREGADO EN DESPACHO') {
          data.cell.styles.textColor = [185, 28, 28]; // Red 700
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.text[0] === 'AUTORIZADO') {
          data.cell.styles.textColor = [21, 128, 61]; // Green 700
        }
      }
    },
    styles: { cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' }
    }
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY || 105;

  // Footer / Signatures
  const finalY = tableFinalY + 40;
  
  doc.setTextColor(0);
  doc.line(20, finalY, 80, finalY);
  doc.text('Firma Responsable', 35, finalY + 5);

  doc.line(pageWidth - 80, finalY, pageWidth - 20, finalY);
  doc.text('Firma Alumno', pageWidth - 65, finalY + 5);

  // Save
  doc.save(`prestamo_${loan.alumno_nombre.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

export const generateReservationPDF = (reservation: any, equipments: Equipment[], docenteEmail?: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Icon/Logo
  doc.setFillColor(15, 23, 42);
  doc.circle(20, 20, 5, 'F');

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('SGEA - Comprobante de Reserva', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Escuela de Cine, Video y TV (UNT)', pageWidth / 2, 28, { align: 'center' });

  // Reservation Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Nro de Operación: ${reservation.id?.slice(0, 8).toUpperCase() || 'N/A'}`, 20, 45);
  doc.text(`Docente: ${reservation.docente_nombre}`, 20, 52);
  doc.text(`Email Docente: ${docenteEmail || 'N/A'}`, 20, 59);
  
  const isAutoAval = (reservation.materia || '').includes('[Auto-Aval Docente]');
  doc.text(`Aval Docente: ${isAutoAval ? `${reservation.docente_nombre} (Auto-Aval)` : (reservation.autorizado_por_docente || 'Pendiente')}`, 20, 66);
  
  doc.text(`Fecha Desde: ${formatDateTime(reservation.fecha_inicio)}`, 20, 73);
  doc.text(`Fecha Hasta: ${formatDateTime(reservation.fecha_fin)}`, 20, 80);
  doc.text(`Estado: ${reservation.estado.toUpperCase()}`, 20, 87);
  
  // Extract tipo_uso from materia if it's encoded there
  let displayUsage = reservation.tipo_uso;
  if (!displayUsage && reservation.materia?.startsWith('[')) {
    const match = reservation.materia.match(/^\[(.*?)\]/);
    if (match) displayUsage = match[1];
  }

  if (displayUsage) {
    doc.text(`Tipo de Uso: ${displayUsage}`, 110, 87);
  }

  const isAdminInterno = (reservation.materia || '').includes('[Uso Interno - Admin]');
  const isReady = reservation.estado === 'Aprobada' || reservation.estado === 'Avalada' || reservation.estado === 'Activa';
  
  let statusMsg = isReady 
    ? 'LISTA PARA DESPACHO (Autorizado)' 
    : 'PENDIENTE DE AUTORIZACIÓN (Requiere Director)';
  
  if (isAdminInterno) {
    statusMsg = 'LISTA PARA DESPACHO (Uso Interno Administración)';
  }
  
  doc.setFontSize(12);
  if (isReady || isAdminInterno) {
    doc.setTextColor(22, 163, 74);
  } else {
    doc.setTextColor(245, 158, 11);
  }
  doc.setFont('helvetica', 'bold');
  doc.text(statusMsg, pageWidth / 2, 38, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  // Equipment Table
  const tableData = equipments.map((eq, index) => [
    index + 1,
    eq.nombre,
    eq.modelo,
    eq.categoria
  ]);

  autoTable(doc, {
    startY: 102,
    head: [['#', 'Equipo', 'Modelo', 'Categoría']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42] },
    theme: 'grid',
  });

  // Footnote / Signatures
  const finalY = (doc as any).lastAutoTable.finalY + 25;
  
  if (!isAdminInterno) {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.line(20, finalY, 80, finalY);
    doc.text('Firma Docente / Responsable', 20, finalY + 5);
    
    doc.line(pageWidth - 80, finalY, pageWidth - 20, finalY);
    doc.text('Firma Autoridad (Director)', pageWidth - 80, finalY + 5);
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'italic');
    doc.text('Reserva de uso interno generada por Administración. No requiere avales adicionales.', 20, finalY);
  }

  // Save
  doc.save(`reserva_${reservation.docente_nombre.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

export const generateReturnPDF = (
  loan: Loan, 
  equipments: Equipment[], 
  responsableRecibe: string, 
  docenteEmail?: string,
  itemConditions?: Record<string, 'ok' | 'problem' | null>,
  itemNotes?: Record<string, string>
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Icon/Logo
  doc.setFillColor(34, 197, 94);
  doc.circle(20, 20, 5, 'F');

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('SGEA - Comprobante de Devolución', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Escuela de Cine, Video y TV (UNT)', pageWidth / 2, 28, { align: 'center' });

  // Return Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Nro de Operación (Préstamo): ${loan.id.slice(0, 8).toUpperCase()}`, 20, 45);
  doc.text(`Fecha de Devolución: ${formatDate(new Date().toISOString())}`, 20, 52);
  doc.text(`Responsable (Administrador): ${responsableRecibe}`, 20, 59);
  doc.text(`Email Docente: ${docenteEmail || 'N/A'}`, 20, 66);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Docente a Cargo: ${loan.docente_responsable || 'N/A'}`, 20, 77);
  doc.text(`Alumno: ${loan.alumno_nombre} (DNI: ${loan.alumno_dni})`, 20, 84);

  // Equipment Table
  const tableData = equipments.map((eq, index) => {
    const condition = itemConditions?.[eq.id] || 'ok';
    const note = itemNotes?.[eq.id] || '';
    
    let statusText = condition === 'ok' ? 'RECIBIDO OK' : 'REPORTADO CON PROBLEMA';
    if (note && condition === 'problem') {
      statusText = `PROBLEMA: ${note}`;
    }

    return [
      index + 1,
      eq.nombre,
      eq.modelo,
      eq.numero_serie,
      statusText
    ];
  });

  autoTable(doc, {
    startY: 95,
    head: [['#', 'Equipo', 'Modelo', 'Nº Serie', 'Estado al Recibir']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42] },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        if (data.cell.text[0].includes('PROBLEMA:')) {
          data.cell.styles.textColor = [185, 28, 28]; // Red 700
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.text[0] === 'RECIBIDO OK') {
          data.cell.styles.textColor = [21, 128, 61]; // Green 700
        }
      }
    }
  });

  // Disclaimer / Notes
  const tableFinalY = (doc as any).lastAutoTable.finalY || 95;
  if (loan.observaciones_recepcion && loan.observaciones_recepcion !== 'Recibido OK') {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Observaciones Generales: ${loan.observaciones_recepcion}`, 20, tableFinalY + 10);
  }

  // Signature
  const finalY = tableFinalY + 40;
  doc.line(pageWidth / 2 - 30, finalY, pageWidth / 2 + 30, finalY);
  doc.text('Firma Digital (Administrador)', pageWidth / 2, finalY + 5, { align: 'center' });
  doc.setFontSize(8);
  doc.text(responsableRecibe, pageWidth / 2, finalY + 10, { align: 'center' });

  // Save
  doc.save(`devolucion_${loan.alumno_nombre.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

export const generateStudentRequestVoucherPDF = (request: any, equipments: Equipment[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Icon/Logo
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.circle(20, 20, 5, 'F');

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('SGEA - Constancia de Solicitud', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Escuela de Cine, Video y TV (UNT)', pageWidth / 2, 28, { align: 'center' });

  // Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Nro de Reserva: ${request.id?.slice(0, 8).toUpperCase() || 'PAGADO'}`, 20, 45);
  doc.text(`Fecha de Solicitud: ${formatDate(new Date().toISOString())}`, 20, 52);
  doc.text(`Alumno: ${request.responsable}`, 20, 59);
  doc.text(`Materia/Proyecto: ${request.materia}`, 20, 66);
  doc.text(`Docente Aval: ${request.docente_nombre}`, 20, 73);
  doc.text(`Desde: ${formatDate(request.fecha_inicio)}`, 20, 80);
  doc.text(`Hasta: ${formatDate(request.fecha_fin)}`, 20, 87);

  // Equipment Table
  const tableData = equipments.map((eq, index) => [
    index + 1,
    eq.nombre,
    eq.modelo,
    eq.categoria
  ]);

  autoTable(doc, {
    startY: 95,
    head: [['#', 'Equipo', 'Modelo', 'Categoría']],
    body: tableData,
    headStyles: { fillColor: [79, 70, 229] },
    theme: 'grid',
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY || 95;

  // Disclaimer
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'italic');
  const disclaimerText = 'NOTA IMPORTANTE: Esta reserva está sujeta a la aprobación del docente y la disponibilidad técnica de los equipos en Pañol. Este documento no garantiza el retiro del material si no se cumplen las condiciones reglamentarias.';
  const splitText = doc.splitTextToSize(disclaimerText, pageWidth - 40);
  doc.text(splitText, 20, tableFinalY + 15);

  // Save
  doc.save(`solicitud_${request.responsable.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};
