"""Single-file desktop calculator. Run: python calculator.py"""

import ast
import operator
import tkinter as tk
from tkinter import ttk


class Calculator(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Calculator")
        self.resizable(False, False)
        self.configure(bg="#111827", padx=18, pady=18)
        self.expression = ""
        self.just_calculated = False

        self.display = tk.StringVar(value="0")
        self._build_ui()
        self.bind("<Key>", self._key_press)

    def _build_ui(self):
        tk.Label(
            self, textvariable=self.display, anchor="e", font=("Segoe UI", 30, "bold"),
            bg="#111827", fg="#f9fafb", padx=14, pady=20, width=15,
        ).grid(row=0, column=0, columnspan=4, sticky="ew", pady=(0, 14))

        buttons = [
            ("C", "clear"), ("±", "sign"), ("%", "percent"), ("÷", "/"),
            ("7", "7"), ("8", "8"), ("9", "9"), ("×", "*"),
            ("4", "4"), ("5", "5"), ("6", "6"), ("−", "-"),
            ("1", "1"), ("2", "2"), ("3", "3"), ("+", "+"),
            ("0", "0"), (".", "."), ("⌫", "backspace"), ("=", "="),
        ]
        for index, (label, value) in enumerate(buttons):
            row, column = divmod(index, 4)
            operator_button = value in {"/", "*", "-", "+", "="}
            special_button = value in {"clear", "sign", "percent", "backspace"}
            color = "#f97316" if operator_button else "#374151" if special_button else "#1f2937"
            button = tk.Button(
                self, text=label, command=lambda v=value: self._press(v), borderwidth=0,
                font=("Segoe UI", 16, "bold"), bg=color, fg="#ffffff", activebackground="#fb923c",
                activeforeground="#ffffff", width=5, height=2, cursor="hand2",
            )
            button.grid(row=row + 1, column=column, padx=4, pady=4, sticky="nsew")

    def _key_press(self, event):
        key = event.char if event.char in "0123456789.+-*/%" else event.keysym
        keys = {"Return": "=", "Escape": "clear", "BackSpace": "backspace"}
        if key in keys:
            key = keys[key]
        if key in "0123456789.+-*/%" or key in {"=", "clear", "backspace"}:
            self._press(key)

    def _press(self, value):
        if value == "clear":
            self.expression, self.just_calculated = "", False
        elif value == "backspace":
            self.expression, self.just_calculated = self.expression[:-1], False
        elif value == "sign":
            self.expression = f"-({self.expression or '0'})"
        elif value == "percent":
            self.expression = f"({self.expression or '0'})/100"
        elif value == "=":
            self._calculate()
            return
        else:
            if self.just_calculated and value not in "+-*/%":
                self.expression = ""
            self.expression += value
            self.just_calculated = False
        self.display.set(self.expression or "0")

    def _calculate(self):
        try:
            result = safe_eval(self.expression)
            self.expression = format(result, ".12g")
            self.display.set(self.expression)
            self.just_calculated = True
        except (ValueError, ZeroDivisionError, SyntaxError):
            self.expression, self.just_calculated = "", False
            self.display.set("Error")


def safe_eval(expression):
    """Evaluate only arithmetic literals and +, -, *, / operations."""
    operations = {
        ast.Add: operator.add, ast.Sub: operator.sub,
        ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.USub: operator.neg, ast.UAdd: operator.pos,
    }

    def evaluate(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in operations:
            return operations[type(node.op)](evaluate(node.left), evaluate(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in operations:
            return operations[type(node.op)](evaluate(node.operand))
        raise ValueError("Unsupported expression")

    return evaluate(ast.parse(expression, mode="eval").body)


if __name__ == "__main__":
    assert safe_eval("2 + 3 * 4") == 14
    assert safe_eval("-(10 / 2)") == -5
    Calculator().mainloop()
