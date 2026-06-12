const mongoose = require('mongoose');
const paymentService = require('../../src/modules/contracts/services/paymentService.js');
const PaymentTransaction = require('../../src/modules/contracts/models/transactionModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');

// Mocking Mongoose Models
jest.mock('../../src/modules/contracts/models/transactionModel.js');
jest.mock('../../src/modules/contracts/models/contractModel.js');

describe('Payment Service - Unit Test', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    // ===================== createPayment =====================
    describe('createPayment', () => {
        const basePaymentData = {
            contractId: 'contract_001',
            clientId: 'client_001',
            amount: 5000000,
            transactionType: 'Deposit',
            paymentMethod: 'Cash',
            notes: 'Đặt cọc lần 1',
            processedBy: 'staff_001'
        };

        const mockContract = {
            _id: 'contract_001',
            totalAmount: 10000000,
            paidAmount: 0,
            paymentMethods: [],
            paymentStatus: 'Unpaid',
            contractStatus: 'Draft'
        };

        it('Should create payment and update contract paidAmount', async () => {
            Contract.findById.mockResolvedValue({ ...mockContract });
            PaymentTransaction.create.mockResolvedValue({
                _id: 'txn_001',
                receiptNumber: 'RCP-2026-04-0001',
                ...basePaymentData,
                status: 'Success'
            });
            Contract.findByIdAndUpdate.mockResolvedValue({
                ...mockContract,
                paidAmount: 5000000,
                paymentStatus: 'Deposit'
            });

            const result = await paymentService.createPayment(basePaymentData);

            expect(PaymentTransaction.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    contractId: 'contract_001',
                    amount: 5000000,
                    status: 'Success'
                })
            );
            expect(Contract.findByIdAndUpdate).toHaveBeenCalledWith(
                'contract_001',
                expect.objectContaining({
                    paidAmount: 5000000,
                    paymentStatus: 'Deposit'
                }),
                { new: true }
            );
            expect(result.transaction.receiptNumber).toBe('RCP-2026-04-0001');
            expect(result.contract.paidAmount).toBe(5000000);
        });

        it('Should set paymentStatus to Paid when full amount is paid', async () => {
            const contractFullPay = { ...mockContract, paidAmount: 5000000, paymentMethods: ['Cash'] };
            Contract.findById.mockResolvedValue(contractFullPay);
            PaymentTransaction.create.mockResolvedValue({ _id: 'txn_002', amount: 5000000, status: 'Success' });
            Contract.findByIdAndUpdate.mockResolvedValue({
                ...contractFullPay,
                paidAmount: 10000000,
                paymentStatus: 'Paid',
                contractStatus: 'Active'
            });

            const result = await paymentService.createPayment({
                ...basePaymentData,
                amount: 5000000,
                transactionType: 'Balance_Payment'
            });

            expect(Contract.findByIdAndUpdate).toHaveBeenCalledWith(
                'contract_001',
                expect.objectContaining({
                    paidAmount: 10000000,
                    paymentStatus: 'Paid',
                    contractStatus: 'Active'
                }),
                { new: true }
            );
            expect(result.contract.paymentStatus).toBe('Paid');
        });

        it('Should throw error if contract not found', async () => {
            Contract.findById.mockResolvedValue(null);

            await expect(paymentService.createPayment(basePaymentData))
                .rejects.toThrow('Hợp đồng không tồn tại');
        });

        it('Should throw error if amount is zero or negative', async () => {
            Contract.findById.mockResolvedValue({ ...mockContract });

            await expect(paymentService.createPayment({ ...basePaymentData, amount: 0 }))
                .rejects.toThrow('Số tiền phải lớn hơn 0');

            await expect(paymentService.createPayment({ ...basePaymentData, amount: -1000 }))
                .rejects.toThrow('Số tiền phải lớn hơn 0');
        });

        it('Should throw error if amount exceeds remaining debt', async () => {
            Contract.findById.mockResolvedValue({ ...mockContract, paidAmount: 8000000 });

            await expect(paymentService.createPayment({ ...basePaymentData, amount: 5000000 }))
                .rejects.toThrow(/vượt quá công nợ còn lại/);
        });

        it('Should append new paymentMethod if not already tracked', async () => {
            Contract.findById.mockResolvedValue({ ...mockContract, paymentMethods: ['Cash'] });
            PaymentTransaction.create.mockResolvedValue({ _id: 'txn_003', status: 'Success' });
            Contract.findByIdAndUpdate.mockResolvedValue({});

            await paymentService.createPayment({ ...basePaymentData, paymentMethod: 'Transfer' });

            expect(Contract.findByIdAndUpdate).toHaveBeenCalledWith(
                'contract_001',
                expect.objectContaining({
                    paymentMethods: ['Cash', 'Transfer']
                }),
                { new: true }
            );
        });

        it('Should NOT duplicate paymentMethod if already tracked', async () => {
            Contract.findById.mockResolvedValue({ ...mockContract, paymentMethods: ['Cash'] });
            PaymentTransaction.create.mockResolvedValue({ _id: 'txn_004', status: 'Success' });
            Contract.findByIdAndUpdate.mockResolvedValue({});

            await paymentService.createPayment({ ...basePaymentData, paymentMethod: 'Cash' });

            const updateCall = Contract.findByIdAndUpdate.mock.calls[0][1];
            expect(updateCall.paymentMethods).toBeUndefined(); // Shouldn't update methods
        });
    });

    // ===================== getPaymentHistory =====================
    describe('getPaymentHistory', () => {
        it('Should return sorted transactions for a contract', async () => {
            const mockTransactions = [
                { _id: 'txn_2', amount: 3000000, createdAt: new Date('2026-04-20') },
                { _id: 'txn_1', amount: 5000000, createdAt: new Date('2026-04-15') }
            ];

            PaymentTransaction.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockResolvedValue(mockTransactions)
                })
            });

            const result = await paymentService.getPaymentHistory('contract_001');

            expect(PaymentTransaction.find).toHaveBeenCalledWith({ contractId: 'contract_001' });
            expect(result).toHaveLength(2);
            expect(result[0]._id).toBe('txn_2');
        });
    });

    // ===================== getTransactionDetail =====================
    describe('getTransactionDetail', () => {
        it('Should return populated transaction detail', async () => {
            const mockTxn = {
                _id: 'txn_001',
                receiptNumber: 'RCP-2026-04-0001',
                amount: 5000000,
                contractId: { _id: 'contract_001', contractCode: 'HD-001' },
                clientId: { _id: 'client_001', name: 'Nguyễn Văn A' }
            };

            PaymentTransaction.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(mockTxn)
                    })
                })
            });

            const result = await paymentService.getTransactionDetail('txn_001');

            expect(result.receiptNumber).toBe('RCP-2026-04-0001');
            expect(result.clientId.name).toBe('Nguyễn Văn A');
        });

        it('Should throw error if transaction not found', async () => {
            PaymentTransaction.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(null)
                    })
                })
            });

            await expect(paymentService.getTransactionDetail('bad_id'))
                .rejects.toThrow('Không tìm thấy giao dịch');
        });
    });
});
