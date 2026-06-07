# 소통 탭 백엔드 (Cloudflare Worker + KV)

- URL: https://saessak-sotong.repairer5812.workers.dev
- 계정: repairer5812@gmail.com (Cloudflare)
- 저장소: KV 네임스페이스 SOTONG
- 엔드포인트: GET /state · POST /question · POST /feedback · POST /vote · DELETE /item?id=
- 공개 API (로그인 없음, 누구나 제출·삭제) · CORS * · 응답 no-store
- 배포: `CLOUDFLARE_API_TOKEN=<토큰> npx wrangler deploy`
- 주의: KV는 eventually-consistent(~60초). 제출자는 낙관적 UI로 즉시 보이고, 타인 동기화는 최대 ~60초.
