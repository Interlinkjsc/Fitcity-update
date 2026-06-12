const driveService = require('../../src/modules/platform/services/driveService.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const fs = require('fs');
const { google } = require('googleapis');

describe('Drive Service Edge Coverage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('getDriveClient should handle missing credentials file', async () => {
        const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        jest.spyOn(fs, 'createReadStream').mockReturnValue('mock_stream');
        // uploadToDrive will call getDriveClient, which returns null, then falls back to Mock
        const res = await driveService.uploadToDrive('path', 'name');
        expect(res).toMatch(/^mock_drive_id_/);
    });

    it('getDriveClient should handle auth throw', async () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'createReadStream').mockReturnValue('mock_stream');
        jest.spyOn(google.auth, 'GoogleAuth').mockImplementation(() => {
            throw new Error('Auth fail');
        });
        const res = await driveService.uploadToDrive('path', 'name');
        expect(res).toMatch(/^mock_drive_id_/);
    });

    it('uploadToDrive should handle read stream failure', async () => {
        const mockDrive = {
            files: { create: jest.fn().mockResolvedValue({ data: { id: 'f1' } }) }
        };
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(google.auth, 'GoogleAuth').mockImplementation(() => ({}));
        jest.spyOn(google, 'drive').mockReturnValue(mockDrive);
        
        // Mocking fs.createReadStream to throw
        jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
            throw new Error('Read fail');
        });

        const res = await driveService.uploadToDrive('f', 'n', 'folder');
        expect(res).toContain('OFFLINE_CACHE');
        expect(console.error).toHaveBeenCalled();
    });

    it('uploadToDrive should hit success path with real-ish mock', async () => {
        const mockDrive = {
            files: { create: jest.fn().mockResolvedValue({ data: { id: 'cloud_f1' } }) }
        };
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(google.auth, 'GoogleAuth').mockImplementation(() => ({}));
        jest.spyOn(google, 'drive').mockReturnValue(mockDrive);
        jest.spyOn(fs, 'createReadStream').mockReturnValue('stream');

        const res = await driveService.uploadToDrive('path', 'name');
        expect(res).toBe('cloud_f1');
    });

    it('attachDriveIdToContract should handle DB error', async () => {
        jest.spyOn(Contract, 'findByIdAndUpdate').mockRejectedValue(new Error('DB err'));
        const res = await driveService.attachDriveIdToContract('c1', 'f1');
        expect(res).toBe(false);
    });
});
