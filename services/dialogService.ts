import Swal, { SweetAlertIcon } from 'sweetalert2';

interface ConfirmActionOptions {
  title: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  icon?: SweetAlertIcon;
  tone?: 'default' | 'danger';
}

interface AutoDismissToastOptions {
  title: string;
  icon?: SweetAlertIcon;
  timer?: number;
}

const baseDialogOptions = {
  background: '#1f2235',
  color: '#e2e8f0',
  reverseButtons: true,
  focusCancel: true,
  buttonsStyling: false,
  scrollbarPadding: false,
  customClass: {
    popup: 'rounded-[28px] border border-white/10 bg-[#1f2235] px-2 pb-2 pt-3 shadow-2xl',
    title: 'px-4 pt-3 text-left text-xl font-black text-white',
    htmlContainer: 'px-4 pb-1 text-left text-sm font-medium leading-relaxed text-slate-300',
    actions: 'mt-1 flex w-full gap-3 px-4 pb-4',
  },
};

const getConfirmButtonClassName = (tone: ConfirmActionOptions['tone']) => (
  tone === 'danger'
    ? 'inline-flex min-w-[112px] items-center justify-center rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white transition-all hover:bg-red-400 focus:outline-none'
    : 'inline-flex min-w-[112px] items-center justify-center rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 transition-all hover:bg-cyan-400 focus:outline-none'
);

const cancelButtonClassName = 'inline-flex min-w-[112px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 transition-all hover:bg-white/10 focus:outline-none';

export const confirmAction = async ({
  title,
  text,
  html,
  confirmButtonText = '確認',
  cancelButtonText = '取消',
  icon = 'warning',
  tone = 'default',
}: ConfirmActionOptions): Promise<boolean> => {
  const result = await Swal.fire({
    ...baseDialogOptions,
    title,
    text,
    html,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    customClass: {
      ...baseDialogOptions.customClass,
      confirmButton: getConfirmButtonClassName(tone),
      cancelButton: cancelButtonClassName,
    },
  });

  return result.isConfirmed;
};

export const showAutoDismissToast = async ({
  title,
  icon = 'success',
  timer = 1800,
}: AutoDismissToastOptions): Promise<void> => {
  await Swal.fire({
    position: 'center',
    icon,
    title,
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
    backdrop: false,
    background: '#1f2235',
    color: '#e2e8f0',
    buttonsStyling: false,
    scrollbarPadding: false,
    customClass: {
      popup: 'rounded-[28px] border border-white/10 bg-[#1f2235] px-2 pb-4 pt-3 shadow-2xl',
      title: 'px-4 pt-3 text-base font-bold text-white',
      timerProgressBar: 'bg-emerald-300',
    },
  });
};
