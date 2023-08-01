import 'element-plus/es/components/message/style/css';
import { ElMessage } from 'element-plus';

export default function useToast(){

  function toast(message: string, type: 'success' | 'warning' | 'info' | 'error' = 'success') {
    ElMessage({
      message,
      grouping: true,
      type,
      offset: 80,
    });
  }

  return {
    toast,
  };
}