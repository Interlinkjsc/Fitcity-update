/**
 * Unit Test for PDF Generation Service
 */
const pdfService = require('../../src/modules/contracts/services/pdfService.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

describe('PDF Service Logic', () => {
    const tempFilePath = path.join(__dirname, '../../tmp/test_contract.pdf');

    beforeAll(() => {
        const tmpDir = path.join(__dirname, '../../tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    });

    afterAll(() => {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    });

    it('Should generate a PDF file from mock contract data', async () => {
        const mockContract = {
            _id: new mongoose.Types.ObjectId(),
            client: { name: 'Test Client', email: 'test@example.com', phone: '0901234567' },
            servicePackage: { name: 'Platinum 1 Year', sessions: 50, duration: 365 },
            pt: { name: 'Coach Master' },
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            basePrice: 20000000,
            discount: 2000000,
            totalAmount: 19800000, // (20-2)*1.1
            paymentStatus: 'Paid'
        };

        const resultPath = await pdfService.generateContractPDF(mockContract, tempFilePath);
        
        expect(resultPath).toBe(tempFilePath);
        expect(fs.existsSync(tempFilePath)).toBe(true);
        
        const stats = fs.statSync(tempFilePath);
        expect(stats.size).toBeGreaterThan(1000); // Should be at least 1KB
    });
    it('Should handle synchronous error during PDF generation', async () => {
        const mockContract = null; // Will cause crash when reading _id
        await expect(pdfService.generateContractPDF(mockContract, tempFilePath)).rejects.toThrow();
    });

    it('Should handle stream error', async () => {
        const mockContract = {
            _id: new mongoose.Types.ObjectId(),
            client: { name: 'Test' },
            servicePackage: { name: 'Package' },
            startDate: new Date(),
            endDate: new Date()
        };
        // Invalid path causes stream error
        await expect(pdfService.generateContractPDF(mockContract, '/invalid/path/dir/file.pdf')).rejects.toThrow();
    });

    it('Should handle missing client and package data (edge case for coverage)', async () => {
        const mockContract = {
            _id: new mongoose.Types.ObjectId(),
            startDate: new Date(),
            endDate: new Date(),
            basePrice: 1000,
            discount: 0,
            totalAmount: 1100
        };
        const resultPath = await pdfService.generateContractPDF(mockContract, tempFilePath);
        expect(fs.existsSync(resultPath)).toBe(true);
    });
});
