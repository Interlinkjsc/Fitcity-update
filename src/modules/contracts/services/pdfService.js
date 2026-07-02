const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Service to generate Professional Fitness Contract PDF with Vietnamese support
 * Uses a system font for guaranteed Unicode encoding
 */
exports.generateContractPDF = (contract, outputPath) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                bufferPages: true
            });

            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Set font for Unicode support (Vietnamese)
            // Path to our copied font file
            const fontPath = path.join(__dirname, '../../../assets/fonts/Roboto-Regular.ttf');
            if (fs.existsSync(fontPath)) {
                doc.font(fontPath);
            } else {
                // Should not happen as we verified it, but fallback gracefully
                doc.font('Helvetica');
            }

            // --- HEADER ---
            doc.fillColor('#000000').rect(0, 0, doc.page.width, 100).fill();
            doc.fillColor('#ccff00').fontSize(28).text('FITCITY', 50, 35, { characterSpacing: 2 });
            
            const branch = contract.branch || {};
            doc.fillColor('#94a3b8').fontSize(9).text('TRUNG TÂM LUYỆN TẬP THỂ HÌNH CAO CẤP', 50, 70);
            
            if (branch.name) {
                doc.fillColor('#ffffff').fontSize(11).text(branch.name.toUpperCase(), 350, 35, { align: 'right' });
                doc.fontSize(8).text(branch.address || '', 350, 52, { align: 'right' });
                doc.text(`Hotline: ${branch.phone || 'N/A'}`, 350, 65, { align: 'right' });
            }

            doc.moveDown(5);
            
            // --- CONTRACT TITLE ---
            doc.fillColor('#1e293b').fontSize(20).text('HỢP ĐỒNG CUNG CẤP DỊCH VỤ TẬP LUYỆN', { align: 'center' });
            doc.fillColor('#64748b').fontSize(10).text(`Mã số: ${contract.contractCode || contract._id.toString().toUpperCase()}`, { align: 'center' });
            doc.moveDown(2);

            // --- SECTION HELPERS ---
            const drawSectionHeader = (title) => {
                const currentY = doc.y;
                doc.fillColor('#f8fafc').rect(50, currentY, 495, 25).fill();
                doc.fillColor('#0f172a').fontSize(11).text(title.toUpperCase(), 60, currentY + 7);
                doc.moveDown(1.5);
            };

            const drawEntry = (label, value) => {
                doc.fillColor('#475569').fontSize(10).text(label, 60, doc.y, { continued: true });
                doc.fillColor('#1e293b').text(`: ${value || 'N/A'}`);
                doc.moveDown(0.5);
            };

            // --- SECTION 1: CUSTOMER ---
            drawSectionHeader('Bên A: Thông tin khách hàng');
            const client = contract.client || {};
            drawEntry('Họ và tên', client.name);
            // Bug 1.5/1.6 (2/7): hợp đồng phải thể hiện CCCD, giới tính, SĐT khẩn cấp theo form chuẩn
            drawEntry('Số CCCD / Hộ chiếu', client.cccdNumber);
            drawEntry('Giới tính', client.gender);
            if (client.dob) drawEntry('Ngày sinh', new Date(client.dob).toLocaleDateString('vi-VN'));
            drawEntry('Địa chỉ email', client.email);
            drawEntry('Số điện thoại', client.phone);
            if (client.address) drawEntry('Địa chỉ liên lạc', client.address);
            const emergency = client.emergencyContact || {};
            drawEntry('Liên hệ khẩn cấp', emergency.phone ? `${emergency.name ? emergency.name + ' — ' : ''}${emergency.phone}${emergency.relationship ? ' (' + emergency.relationship + ')' : ''}` : null);
            doc.moveDown(1.5);

            // --- SECTION 2: SERVICE ---
            drawSectionHeader('Bên B: Chi tiết dịch vụ gym/pt');
            
            // Prefer packageSnapshot for historical accuracy and custom packages
            const pkgInfo = contract.packageSnapshot || contract.servicePackage || {};
            
            drawEntry('Tên gói dịch vụ', pkgInfo.name);
            drawEntry('Hình thức', contract.pt ? `Có PT hướng dẫn (${contract.pt.name})` : 'Tập tự do (Gym Only)');
            drawEntry('Số lượng buổi tập', `${contract.totalSessions || pkgInfo.sessions || 0} buổi`);
            
            const { formatDurationLabel } = require('../../../utils/contractDurationHelper');
            drawEntry('Thời hạn sử dụng', formatDurationLabel(pkgInfo));
            
            drawEntry('Thời gian hiệu lực', `${new Date(contract.startDate).toLocaleDateString('vi-VN')} đến ${new Date(contract.endDate).toLocaleDateString('vi-VN')}`);
            doc.moveDown(1.5);

            // --- SECTION 3: FINANCE ---
            drawSectionHeader('Điều khoản tài chính');
            const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
            
            drawEntry('Tổng trước chiết khấu (giá/buổi × số buổi)', currencyFormatter.format(contract.basePrice));
            if (contract.discount > 0) {
                drawEntry('Chiết khấu/Khuyến mãi', `-${currencyFormatter.format(contract.discount)}`);
            }
            drawEntry('Thuế GTGT (10%)', currencyFormatter.format(Math.round((contract.basePrice - contract.discount) * 0.1)));
            
            doc.moveDown(0.5);
            doc.fontSize(14).fillColor('#0f172a').text(`TỔNG CỘNG THANH TOÁN: ${currencyFormatter.format(contract.totalAmount)}`, 60);
            
            let statusText = 'CHƯA THANH TOÁN';
            if (contract.paymentStatus === 'Paid') statusText = 'ĐÃ THANH TOÁN TOÀN BỘ';
            if (contract.paymentStatus === 'Deposit') statusText = 'ĐÃ ĐẶT CỌC DỊCH VỤ';
            doc.fontSize(10).fillColor('#64748b').text(`Trạng thái xác thực: ${statusText}`, 60);
            doc.moveDown(3);

            // --- SIGNATURES ---
            const startY = doc.y;
            doc.fontSize(10).fillColor('#1e293b').text('ĐẠI DIỆN FITCITY', 80, startY);
            doc.text('CHỮ KÝ KHÁCH HÀNG', 380, startY);
            
            doc.fontSize(7).fillColor('#94a3b8').text('(Ký, đóng dấu và ghi rõ họ tên)', 80, startY + 15);
            doc.text('(Ký và ghi rõ họ tên)', 380, startY + 15);

            // Footer
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).fillColor('#94a3b8').text(
                    `CHỨNG TỪ ĐIỆN TỬ - Bản quyền thuộc về FitCity. Trang ${i + 1}/${range.count}`,
                    50,
                    doc.page.height - 40,
                    { align: 'center' }
                );
            }

            doc.end();

            stream.on('finish', () => resolve(outputPath));
            stream.on('error', (err) => reject(err));

        } catch (err) {
            reject(err);
        }
    });
};
