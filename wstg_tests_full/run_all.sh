#!/bin/bash
# Script untuk menjalankan seluruh pengujian WSTG
# Jalankan dari direktori wstg_tests/

echo "Installing dependencies..."
pip install pytest requests pytest-html --break-system-packages -q

echo ""
echo "Running WSTG full test suite..."
echo "Target: https://takarzein.plutolab.my.id"
echo ""

pytest . \
  --html=wstg_report.html \
  --self-contained-html \
  -v \
  --tb=short \
  --no-header \
  -rN \
  2>&1 | tee wstg_results.txt

echo ""
echo "Report generated: wstg_report.html"
echo "Results log: wstg_results.txt"
