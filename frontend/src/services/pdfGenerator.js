// frontend/src/services/pdfGenerator.js
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const generateLabRequisitionPDF = (requisitionData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header - Compact Labcorp branding
    doc.setFillColor(0, 47, 135); // Labcorp blue
    doc.rect(0, 0, pageWidth, 15, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('LABCORP LABORATORY REQUISITION', pageWidth / 2, 10, { align: 'center' });

    doc.setTextColor(0, 0, 0);

    // Requisition Number and Date - More compact
    let yPos = 22;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Requisition #: ${requisitionData.requisitionNumber || `REQ-${Date.now()}`}`, 15, yPos);
    doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, pageWidth - 45, yPos);

    yPos = 30;

    // Provider Information - Compact box
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(15, yPos, pageWidth - 30, 22, 'S');

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('ORDERING PROVIDER', 18, yPos + 5);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`${requisitionData.providerName || 'Dr. Merrick Reynolds, MD'} | NPI: ${requisitionData.providerNPI || '1295302339'}`, 18, yPos + 10);
    doc.text('MOONLIT | 6211 S Highland Drive, Holladay, UT 84121', 18, yPos + 15);
    doc.text('Phone: 385-246-2522 | Fax: 801-810-1343', 18, yPos + 20);

    yPos += 28;

    // Patient Information - Compact box
    doc.rect(15, yPos, pageWidth - 30, 17, 'S');
    doc.setFont(undefined, 'bold');
    doc.text('PATIENT', 18, yPos + 5);

    doc.setFont(undefined, 'normal');
    doc.text(`Name: ${requisitionData.patientName} | Sex: ${requisitionData.patientSex || 'N/A'}`, 18, yPos + 10);
    doc.text(`DOB: ${requisitionData.patientDOB}`, 80, yPos + 10);
    doc.text(`Phone: ${requisitionData.patientPhone || 'N/A'}`, 130, yPos + 10);
    doc.text(`Medicaid ID: ${requisitionData.medicaidId}`, 18, yPos + 15);
    doc.text(`Insurance: ${requisitionData.insuranceProvider || 'UTAH MEDICAID FFS'}`, 80, yPos + 15);

    yPos += 23;

    // Billing Notice - Highlighted
    doc.setFillColor(255, 255, 200);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.rect(15, yPos, pageWidth - 30, 8, 'S');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('✓ BILL INSURANCE - DO NOT BILL PATIENT', pageWidth / 2, yPos + 5.5, { align: 'center' });

    yPos += 14;

    // Diagnosis - Compact
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('DIAGNOSIS:', 18, yPos);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`${requisitionData.diagnosisCode} - ${requisitionData.diagnosisDescription || 'See attached'}`, 45, yPos);

    yPos += 8;

    // Tests Table - Compact with smaller font
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('TESTS ORDERED', 18, yPos);

    yPos += 4;

    if (requisitionData.tests && requisitionData.tests.length > 0) {
        const testData = requisitionData.tests.map((test) => [
            test.code || 'N/A',
            test.name
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Code', 'Test Name']],
            body: testData,
            theme: 'plain',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontSize: 9,
                fontStyle: 'bold',
                cellPadding: 2
            },
            bodyStyles: {
                fontSize: 9,
                cellPadding: 2
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' }
            },
            margin: { left: 18, right: 15 }
        });

        yPos = doc.lastAutoTable.finalY + 8;
    }

    // Special Instructions (if any) - Compact
    if (requisitionData.specialInstructions && requisitionData.specialInstructions.trim()) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text('SPECIAL INSTRUCTIONS:', 18, yPos);
        yPos += 4;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        const instructionLines = doc.splitTextToSize(requisitionData.specialInstructions, pageWidth - 40);
        // Limit to 2 lines to save space
        const limitedLines = instructionLines.slice(0, 2);
        doc.text(limitedLines, 18, yPos);
        yPos += limitedLines.length * 4 + 6;
    }

    // Calculate remaining space
    const bottomSpace = pageHeight - yPos - 35; // Leave 35 for footer and signatures

    // Only add collection location if there's space
    if (bottomSpace > 20) {
        // Collection Location - Compact
        doc.setFillColor(240, 240, 240);
        doc.rect(15, yPos, pageWidth - 30, 14, 'F');
        doc.rect(15, yPos, pageWidth - 30, 14, 'S');
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text('COLLECTION SITE:', 18, yPos + 5);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text('Labcorp Murray - 5126 S State St, Murray, UT 84107', 18, yPos + 10);
        doc.text('Phone: (801) 268-2552', 120, yPos + 10);
        yPos += 20;
    }

    // Signature Section - Fixed position from bottom
    yPos = pageHeight - 35;

    // Draw signature lines
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(20, yPos, 70, yPos);
    doc.line(110, yPos, 160, yPos);

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Provider Signature', 20, yPos + 4);
    doc.text('Date', 110, yPos + 4);

    // Pre-print provider name and date
    doc.setFont(undefined, 'italic');
    doc.setFontSize(9);
    doc.text(requisitionData.providerName || 'Dr. Merrick Reynolds, MD', 20, yPos - 3);
    doc.text(new Date().toLocaleDateString('en-US'), 110, yPos - 3);

    // Footer - Compact
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by MOONLIT Lab Requisition System', pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text(`${new Date().toLocaleString('en-US')}`, pageWidth / 2, pageHeight - 11, { align: 'center' });

    // Fax instruction - Bold and red
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 0, 0);
    doc.text('FAX TO LABCORP MURRAY: (801) 268-2553', pageWidth / 2, pageHeight - 5, { align: 'center' });

    return doc;
};

export const downloadPDF = (requisitionData) => {
    const doc = generateLabRequisitionPDF(requisitionData);
    const fileName = `Labcorp_Requisition_${requisitionData.patientName?.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};

export const printPDF = (requisitionData) => {
    const doc = generateLabRequisitionPDF(requisitionData);
    const pdfDataUri = doc.output('datauristring');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Lab Requisition - ${requisitionData.patientName}</title>
            </head>
            <body style="margin: 0;">
                <embed width="100%" height="100%" src="${pdfDataUri}" type="application/pdf" />
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
        </html>
    `);
};