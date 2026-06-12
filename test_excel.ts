import ExcelJS from 'exceljs';

async function test() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet 1');
  worksheet.addRow(['A1', 'B1', 'C1']);
  worksheet.addRow(['A2', 'B2', 'C2']);
  
  worksheet.eachRow((row, rowNumber) => {
    console.log('Row', rowNumber, row.values);
  });
}
test();
