# 機車 CVT 傳動互動教室

給國小職業試探課程使用的機車 CVT 傳動互動教材。

## 本機預覽

```bash
npm install
npm run dev
```

## 發布流程

1. 將變更合併或推送到 `main`。
2. GitHub Actions 會執行型別檢查與正式建置。
3. 建置成功後，自動部署到 GitHub Pages。

儲存庫第一次使用時，請到 `Settings → Pages`，將 Source 設為 `GitHub Actions`。

## 版本維護

每次正式更新：

1. 修改 `package.json` 的 `version`。
2. 同步修改 `public/version.json`。
3. 在 `CHANGELOG.md` 最上方新增版本與變更摘要。
4. 執行 `npm run check` 與 `npm run build`。
5. 提交訊息建議使用 `release: vX.Y.Z`。
6. 在 GitHub 建立同名版本標籤，例如 `v1.1.0`。

版本規則：

- `1.0.1`：錯字、樣式或小問題修正。
- `1.1.0`：新增教材功能，但不影響既有操作。
- `2.0.0`：大幅改版或更換操作方式。

## 維護重點

- 主要互動程式：`src/App.tsx`
- 視覺與響應式版面：`src/style.css`
- 自動部署：`.github/workflows/deploy-pages.yml`
- 版本紀錄：`CHANGELOG.md`
