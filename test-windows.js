const { windowManagerInstance } = require('./dist/main/main/windowManager');

console.log('=== 測試視窗管理功能 ===\n');

// 測試 1: 獲取所有視窗
console.log('1. 獲取所有視窗列表:');
try {
  const windows = windowManagerInstance.getAllWindows();
  console.log(`   找到 ${windows.length} 個視窗`);
  
  if (windows.length > 0) {
    console.log('   前 3 個視窗:');
    windows.slice(0, 3).forEach((win, idx) => {
      console.log(`   ${idx + 1}. ${win.title} (${win.owner})`);
      console.log(`      位置: (${win.bounds.x}, ${win.bounds.y})`);
      console.log(`      大小: ${win.bounds.width}x${win.bounds.height}`);
    });
  }
} catch (error) {
  console.error('   錯誤:', error.message);
}

console.log('\n2. 獲取當前聚焦視窗:');
try {
  const activeWindow = windowManagerInstance.getActiveWindow();
  if (activeWindow) {
    console.log(`   標題: ${activeWindow.title}`);
    console.log(`   應用: ${activeWindow.owner}`);
    console.log(`   位置: (${activeWindow.bounds.x}, ${activeWindow.bounds.y})`);
    console.log(`   大小: ${activeWindow.bounds.width}x${activeWindow.bounds.height}`);
  } else {
    console.log('   無法獲取當前視窗');
  }
} catch (error) {
  console.error('   錯誤:', error.message);
}

console.log('\n3. 測試方向偵測:');
try {
  const directions = ['up', 'down', 'left', 'right'];
  directions.forEach(dir => {
    const win = windowManagerInstance.findWindowInDirection(dir);
    if (win) {
      console.log(`   ${dir.padEnd(5)}: ${win.title} (${win.owner})`);
    } else {
      console.log(`   ${dir.padEnd(5)}: 沒有找到視窗`);
    }
  });
} catch (error) {
  console.error('   錯誤:', error.message);
}

console.log('\n=== 測試完成 ===');
