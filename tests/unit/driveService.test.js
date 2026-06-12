const driveService = require('../../src/modules/platform/services/driveService.js');
const { google } = require('googleapis');
const stream = require('stream');

jest.mock('googleapis');

describe('Drive Service', () => {
    let mockDrive;
    
    beforeEach(() => {
        mockDrive = {
            files: {
                create: jest.fn(),
                delete: jest.fn()
            }
        };
        google.drive.mockReturnValue(mockDrive);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Should upload file successfully using mock when no credentials', async () => {
        // Since we don't mock getDriveClient directly, we test the fallback logic
        const result = await driveService.uploadToDrive('test.pdf', 'test_file.pdf', 'folder_123');
        expect(result).toMatch(/mock_drive_id_/);
    });

    it('Should handle DB Update Failed in attachDriveIdToContract', async () => {
        const Contract = require('../../src/modules/contracts/models/contractModel.js');
        jest.spyOn(Contract, 'findByIdAndUpdate').mockRejectedValue(new Error('DB Error'));
        const result = await driveService.attachDriveIdToContract('contract_id', 'file_id');
        expect(result).toBe(false);
        Contract.findByIdAndUpdate.mockRestore();
    });

    it('Should attach drive ID successfully', async () => {
        const Contract = require('../../src/modules/contracts/models/contractModel.js');
        jest.spyOn(Contract, 'findByIdAndUpdate').mockResolvedValue(true);
        const result = await driveService.attachDriveIdToContract('contract_id', 'file_id');
        expect(result).toBe(true);
        Contract.findByIdAndUpdate.mockRestore();
    });
});
