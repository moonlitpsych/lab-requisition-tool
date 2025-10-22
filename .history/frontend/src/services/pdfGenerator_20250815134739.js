// frontend/src/services/pdfGenerator.js
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const generateLabRequisitionPDF = (requisitionData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header - Labcorp branding
    doc.setFillColor(0, 47, 135); // Labcorp blue
    doc.rect(0, 0, pageWidth, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('LABCORP LABORATORY REQUISITION', pageWidth / 2, 13, { align: 'center' });

    doc.setTextColor(0, 0, 0);

    // Requisition Number and Date
    let yPos = 28;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Requisition #: ${requisitionData.requisitionNumber || `REQ-${Date.now()}`}`, 15, yPos);
    doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, pageWidth - 50, yPos);

    yPos = 38;

    // Provider Information Box
    doc.setFillColor(240, 240, 245);
    doc.rect(15, yPos, pageWidth - 30, 30, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('ORDERING PROVIDER INFORMATION', 20, yPos + 8);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    yPos += 15;
    doc.text(`Provider: ${requisitionData.providerName || 'Dr. Merrick Reynolds, MD'}`, 20, yPos);
    doc.text(`NPI: ${requisitionData.providerNPI || '1295302339'}`, 110, yPos);

    yPos += 6;
    doc.text('Clinic: MOONLIT', 20, yPos);
    doc.text('Phone: 385-246-2522', 110, yPos);

    yPos += 6;
    doc.text('Address: 6211 S Highland Drive, Holladay, UT 84121', 20, yPos);
    doc.text('Fax: 801-810-1343', 110, yPos);

    yPos += 15;

    // Patient Information Box
    doc.setFillColor(240, 240, 245);
    doc.rect(15, yPos, pageWidth - 30, 24, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PATIENT INFORMATION', 20, yPos + 8);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    yPos += 15;
    doc.text(`Patient: ${requisitionData.patientName}`, 20, yPos);
    doc.text(`DOB: ${requisitionData.patientDOB}`, 110, yPos);

    yPos += 6;
    doc.text(`Medicaid ID: ${requisitionData.medicaidId}`, 20, yPos);
    doc.text(`Phone: ${requisitionData.patientPhone || 'Not provided'}`, 110, yPos);

    yPos += 15;

    // Insurance Information Box
    doc.setFillColor(240, 240, 245);
    doc.rect(15, yPos, pageWidth - 30, 20, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('INSURANCE INFORMATION', 20, yPos + 8);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    yPos += 15;
    doc.text(`Insurance: ${requisitionData.insuranceProvider || 'UTAH MEDICAID FFS'}`, 20, yPos);
    doc.text(`Member ID: ${requisitionData.medicaidId}`, 110, yPos);

    yPos += 10;

    // Billing Notice
    doc.setFillColor(255, 255, 200);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('✓ BILL INSURANCE - DO NOT BILL PATIENT', pageWidth / 2, yPos + 7, { align: 'center' });

    yPos += 18;

    // Tests Ordered Section
    doc.setFillColor(240, 240, 245);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TESTS ORDERED', 20, yPos + 6);

    yPos += 12;

    // Tests Table
    if (requisitionData.tests && requisitionData.tests.length > 0) {
        const testData = requisitionData.tests.map((test, index) => [
            `${index + 1}`,
            test.code || 'N/A',
            test.name
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['#', 'Test Code', 'Test Name']],
            body: testData,
            theme: 'striped',
            headStyles: {
                fillColor: [0, 47, 135],
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 10
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 35 },
                2: { cellWidth: 'auto' }
            },
            margin: { left: 15, right: 15 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
    }

    // Diagnosis Section
    doc.setFillColor(240, 240, 245);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('DIAGNOSIS INFORMATION', 20, yPos + 6);

    yPos += 12;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`ICD-10: ${requisitionData.diagnosisCode}`, 20, yPos);

    if (requisitionData.diagnosisDescription) {
        yPos += 6;
        doc.text(`Description: ${requisitionData.diagnosisDescription}`, 20, yPos);
    }

    yPos += 10;

    // Special Instructions (if any)
    if (requisitionData.specialInstructions) {
        doc.setFillColor(240, 240, 245);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('SPECIAL INSTRUCTIONS', 20, yPos + 6);

        yPos += 12;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const instructionLines = doc.splitTextToSize(requisitionData.specialInstructions, pageWidth - 40);
        doc.text(instructionLines, 20, yPos);
        yPos += instructionLines.length * 5 + 5;
    }

    // Collection Location Box
    yPos += 5;
    doc.setFillColor(220, 230, 240);
    doc.rect(15, yPos, pageWidth - 30, 20, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('SPECIMEN COLLECTION LOCATION', 20, yPos + 6);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Labcorp PSC - Murray', 20, yPos + 11);
    doc.text('5126 S State St, Murray, UT 84107', 20, yPos + 16);
    doc.text('Phone: (801) 268-2552', 110, yPos + 11);

    // Signature Section (with proper spacing from bottom)
    yPos = pageHeight - 45;

    // Signature lines
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 80, yPos);
    doc.line(130, yPos, 190, yPos);

    doc.setFontSize(9);
    doc.text('Provider Signature', 20, yPos + 5);
    doc.text('Date', 130, yPos + 5);

    // Pre-filled provider info
    doc.setFont(undefined, 'italic');
    doc.text(requisitionData.providerName || 'Dr. Merrick Reynolds, MD', 20, yPos - 5);
    doc.text(new Date().toLocaleDateString('en-US'), 130, yPos - 5);

    // Footer
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by MOONLIT Lab Requisition System', pageWidth / 2, pageHeight - 20, { align: 'center' });
    doc.text(`Form generated on ${new Date().toLocaleString('en-US')}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 0, 0);
    doc.text('FAX TO LABCORP MURRAY: (801) 268-2553', pageWidth / 2, pageHeight - 8, { align: 'center' });

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