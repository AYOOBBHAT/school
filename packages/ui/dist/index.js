import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Button({ children, onClick, variant = 'primary' }) {
    const base = 'px-4 py-2 rounded text-sm font-medium';
    const styles = variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-900 hover:bg-gray-300';
    return (_jsx("button", { className: `${base} ${styles}`, onClick: onClick, children: children }));
}
export function Card({ title, children }) {
    return (_jsxs("div", { className: "border rounded-lg p-4 bg-white shadow-sm", children: [_jsx("div", { className: "text-lg font-semibold mb-2", children: title }), _jsx("div", { children: children })] }));
}
