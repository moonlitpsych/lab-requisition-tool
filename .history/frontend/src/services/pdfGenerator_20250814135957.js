// frontend/src/services/pdfGenerator.js
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const generateLabRequisitionPDF = (requisitionData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Colors
    const primaryColor = [67, 56, 202]; // Indigo
    const lightGray = [243, 244, 246];
    const darkGray = [107, 114, 128];

    // Header - Labcorp branding
    doc.setFillColor(0, 47, 135); // Labcorp blue
    doc.rect(0, 0, pageWidth, 25, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('LABCORP LABORATORY REQUISITION', pageWidth / 2, 12, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Patient Service Center: Murray Location', pageWidth / 2, 20, { align: 'center' });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Requisition Number and Date
    doc.setFillColor(...lightGray);
    doc.rect(15, 30, pageWidth - 30, 15, 'F');

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Requisition #: ${requisitionData.requisitionNumber || `REQ-${Date.now()}`}`, 20, 38);
    doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, pageWidth - 60, 38);

    let yPos = 55;

    // Provider & Clinic Information Section
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('ORDERING PROVIDER & CLINIC INFORMATION', 18, yPos + 5.5);
    doc.setTextColor(0, 0, 0);

    yPos += 12;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    // Provider details in two columns
    const providerInfo = [
        ['Provider Name:', requisitionData.providerName || 'Dr. Merrick Reynolds, MD'],
        ['NPI:', requisitionData.providerNPI || '1295302339'],
        ['Clinic:', 'MOONLIT'],
        ['Phone:', '385-246-2522'],
        ['Address:', '6211 S Highland Drive, Holladay, UT 84121'],
        ['Fax:', '801-810-1343']
    ];

    providerInfo.forEach((item, index) => {
        const xPos = index % 2 === 0 ? 20 : 110;
        const rowY = yPos + Math.floor(index / 2) * 7;

        doc.setFont(undefined, 'bold');
        doc.text(item[0], xPos, rowY);
        doc.setFont(undefined, 'normal');
        doc.text(item[1], xPos + 25, rowY);
    });

    yPos += 25;

    // Patient Information Section
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('PATIENT INFORMATION', 18, yPos + 5.5);
    doc.setTextColor(0, 0, 0);

    yPos += 12;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const patientInfo = [
        ['Patient Name:', requisitionData.patientName],
        ['Date of Birth:', requisitionData.patientDOB],
        ['Medicaid ID:', requisitionData.medicaidId],
        ['Phone:', requisitionData.patientPhone || 'Not provided'],
        ['Sex:', requisitionData.patientSex || 'Not specified'],
        ['Collection Date:', new Date().toLocaleDateString('en-US')]
    ];

    patientInfo.forEach((item, index) => {
        const xPos = index % 2 === 0 ? 20 : 110;
        const rowY = yPos + Math.floor(index / 2) * 7;

        doc.setFont(undefined, 'bold');
        doc.text(item[0], xPos, rowY);
        doc.setFont(undefined, 'normal');
        doc.text(item[1], xPos + 25, rowY);
    });

    yPos += 25;

    // Insurance Information Section
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('INSURANCE INFORMATION', 18, yPos + 5.5);
    doc.setTextColor(0, 0, 0);

    yPos += 12;
    doc.setFontSize(10);

    doc.setFont(undefined, 'bold');
    doc.text('Primary Insurance:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text('UTAH MEDICAID FFS', 55, yPos);

    yPos += 7;
    doc.setFont(undefined, 'bold');
    doc.text('Member ID:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(requisitionData.medicaidId, 55, yPos);

    yPos += 7;
    // Important billing notice
    doc.setFillColor(255, 243, 224); // Light yellow
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setFont(undefined, 'bold');
    doc.text('✓ BILL INSURANCE - DO NOT BILL PATIENT', 20, yPos + 6);

    yPos += 15;

    // Tests Ordered Section
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('TESTS ORDERED', 18, yPos + 5.5);
    doc.setTextColor(0, 0, 0);

    yPos += 12;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    // Create test table
    if (requisitionData.tests && requisitionData.tests.length > 0) {
        const testData = requisitionData.tests.map((test, index) => [
            `${index + 1}.`,
            test.code || 'N/A',
            test.name
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['#', 'Test Code', 'Test Name']],
            body: testData,
            theme: 'grid',
            headStyles: {
                fillColor: [243, 244, 246],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 10,
                cellPadding: 3
            },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 30 },
                2: { cellWidth: 'auto' }
            },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
    }

    // Diagnosis Section
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('DIAGNOSIS INFORMATION', 18, yPos + 5.5);
    doc.setTextColor(0, 0, 0);

    yPos += 12;
    doc.setFontSize(10);

    doc.setFont(undefined, 'bold');
    doc.text('ICD-10 Code:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(requisitionData.diagnosisCode, 50, yPos);

    if (requisitionData.diagnosisDescription) {
        yPos += 7;
        doc.setFont(undefined, 'bold');
        doc.text('Description:', 20, yPos);
        doc.setFont(undefined, 'normal');
        const descLines = doc.splitTextToSize(requisitionData.diagnosisDescription, pageWidth - 70);
        doc.text(descLines, 50, yPos);
        yPos += descLines.length * 5;
    }

    yPos += 10;

    // Special Instructions (if any)
    if (requisitionData.specialInstructions) {
        doc.setFillColor(...primaryColor);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('SPECIAL INSTRUCTIONS', 18, yPos + 5.5);
        doc.setTextColor(0, 0, 0);

        yPos += 12;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const instructionLines = doc.splitTextToSize(requisitionData.specialInstructions, pageWidth - 40);
        doc.text(instructionLines, 20, yPos);
        yPos += instructionLines.length * 5 + 5;
    }

    // Lab Location Information
    yPos += 5;
    doc.setFillColor(...lightGray);
    doc.rect(15, yPos, pageWidth - 30, 25, 'F');

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('SPECIMEN COLLECTION LOCATION', 20, yPos + 7);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Labcorp - Murray', 20, yPos + 13);
    doc.text('5126 S State St, Murray, UT 84107', 20, yPos + 18);
    doc.text('Phone: (801) 268-2552', 20, yPos + 23);

    // Signature Section
    yPos = pageHeight - 50;
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 90, yPos);
    doc.line(120, yPos, 190, yPos);

    doc.setFontSize(9);
    doc.text('Provider Signature', 20, yPos + 5);
    doc.text('Date', 120, yPos + 5);

    doc.setFont(undefined, 'bold');
    doc.text(requisitionData.providerName || 'Dr. Merrick Reynolds, MD', 20, yPos + 10);
    doc.text(`NPI: ${requisitionData.providerNPI || '1295302339'}`, 20, yPos + 15);
    doc.text(new Date().toLocaleDateString('en-US'), 120, yPos + 10);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.setFont(undefined, 'normal');
    doc.text('Generated by MOONLIT Lab Requisition System', pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text(`Form generated on ${new Date().toLocaleString('en-US')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('FAX TO LABCORP: Check with Murray PSC for current fax number', pageWidth / 2, pageHeight - 5, { align: 'center' });

    return doc;
};

export const downloadPDF = (requisitionData) => {
    const doc = generateLabRequisitionPDF(requisitionData);
    const fileName = `Labcorp_Requisition_${requisitionData.patientName?.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};

export const printPDF = (requisitionData) => {
    const doc = generateLabRequisitionPDF(requisitionData);
    // Open in new window for printing
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