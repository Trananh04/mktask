# mktask

<p align="center">
  <img src="frontend/public/logo-primary.svg" alt="mktask AI Work Management" width="320" />
</p>

Nền tảng quản lý dự án mã nguồn mở có trợ lí AI để tạo việc, thao tác giao diện, lập kế hoạch dự án và hỗ trợ đội nhóm làm việc theo workspace/project/task.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![NestJS](https://img.shields.io/badge/NestJS-11-red)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Redis](https://img.shields.io/badge/Redis-7-red)
![AI](https://img.shields.io/badge/AI-enabled-purple)

## Tổng quan

mktask là một hệ thống quản lý công việc cho nhóm sản phẩm, phần mềm, marketing hoặc vận hành nội bộ. Dự án được xây theo monorepo:

- `frontend/`: ứng dụng Next.js, chạy ở `http://localhost:8081`
- `backend/`: API NestJS, chạy ở `http://localhost:8080`
- `backend/prisma/`: schema và migration PostgreSQL
- `docker/`, `docker-compose*.yml`: môi trường chạy bằng Docker
- `scripts/`: script hỗ trợ phát triển local
- `docs/`: tài liệu thiết kế và hướng dẫn AI planner

## Tính năng chính

- Quản lý tổ chức, workspace, project và thành viên.
- Quản lý task với trạng thái, độ ưu tiên, nhãn, người phụ trách, người báo cáo, mô tả, bình luận, file đính kèm và time tracking.
- Nhiều kiểu xem công việc: bảng task, Kanban, Gantt, dashboard và các trang phân tích.
- Sprint, workflow/status, task dependency, watcher và activity log.
- Thông báo, email inbox, email template và rule tự động.
- Admin panel cho quản trị người dùng, tổ chức và cấu hình hệ thống.
- Trợ lí AI trong ứng dụng để thao tác nhanh và lập kế hoạch dự án.

## Use case

1. **Lập kế hoạch dự án mới**
   - Quản lý nhập mô tả dự án bằng tiếng Việt.
   - AI chia project, task, kỹ năng cần có, ước lượng thời gian và gợi ý người phù hợp.
   - Người dùng duyệt bản nháp trước khi tạo dữ liệu thật.

2. **Quản lý sprint hằng tuần**
   - Tạo sprint từ backlog.
   - Lọc task theo priority/status.
   - Theo dõi task quá hạn, task bị chặn và tiến độ theo team.

3. **Theo dõi công việc theo workspace**
   - Tách các nhóm như Product, Engineering, Marketing, Support thành workspace.
   - Mỗi workspace có nhiều project, mỗi project có workflow riêng.

4. **Điều phối sự cố hoặc chiến dịch**
   - Tạo nhanh project xử lý incident/campaign.
   - Gán task theo người phụ trách, độ ưu tiên và deadline.
   - Dùng dashboard/report để cập nhật tình trạng.

5. **Tự động hóa tác vụ lặp lại**
   - Tạo rule tự động, thông báo email và cập nhật trạng thái theo luồng làm việc.
   - Dùng trợ lí AI để thực hiện thao tác giao diện thay vì bấm nhiều bước thủ công.

## Trợ lí AI hiện có gì?

Trợ lí AI nằm trong panel bên phải màn hình và dùng cấu hình AI của từng người dùng trong phần Settings.

### 1. AI Chat thao tác giao diện

- Nhận yêu cầu bằng ngôn ngữ tự nhiên.
- Có thể click, nhập dữ liệu, chọn dropdown và scroll trong giao diện mktask.
- Hỗ trợ tạo workspace, project, task.
- Hỗ trợ lọc task theo status, priority, type, assignee.
- Hỗ trợ cập nhật task như status, priority, assignee, sprint.
- Biết ngữ cảnh trang hiện tại để chọn luồng thao tác phù hợp.
- Khi thiếu thông tin quan trọng như workspace, project hoặc tên task, AI sẽ hỏi lại thay vì đoán.

Ví dụ:

```txt
Tạo task "Thiết kế màn hình đăng nhập" trong project Website, priority High.
Lọc các task priority Highest trong workspace Product.
Chuyển task "Fix lỗi thanh toán" sang In Progress.
Tạo workspace Marketing, project Q3 Campaign và task Chuẩn bị landing page.
```

### 2. AI Project Planner

- Kích hoạt bằng các câu như `lập kế hoạch dự án`, `tạo kế hoạch dự án`, `chia task`, `chia việc`, `phân chia công việc`.
- Sinh bản nháp kế hoạch gồm project, task, mô tả, kỹ năng, estimate, story point và priority.
- Phân công người phù hợp dựa trên kỹ năng và tải việc hiện tại của thành viên workspace.
- Người dùng phải xem và bấm xác nhận trước khi hệ thống tạo project/task thật.
- Backend cung cấp API:
  - `POST /api/ai-project-planner/plan`
  - `POST /api/ai-project-planner/apply`

Ví dụ prompt:

```txt
Lập kế hoạch dự án website bán hàng mỹ phẩm.
Yêu cầu gồm đăng nhập, danh sách sản phẩm, giỏ hàng, thanh toán, trang quản trị,
quản lý đơn hàng và báo cáo doanh thu. Hãy chia project, task, kỹ năng cần có,
ước lượng giờ và gợi ý người phù hợp.
```

### 3. Sinh mô tả task bằng AI

- Khi tạo task, AI có thể sinh mô tả ngắn từ tiêu đề task.
- Mô tả tập trung vào mục tiêu, phạm vi và tiêu chí hoàn thành.

### 4. Cấu hình nhà cung cấp AI

Hệ thống hỗ trợ nhiều API tương thích:

- OpenRouter: `https://openrouter.ai/api/v1`
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Ollama/local model: ví dụ `http://localhost:11434`
- Custom endpoint tương thích OpenAI Chat Completions

Trong Settings, người dùng có thể bật/tắt AI, nhập API key, model, API URL và test connection trước khi lưu.

## Yêu cầu môi trường

- Node.js `22+`
- npm `10+`
- PostgreSQL `16+`
- Redis `7+`
- Docker Desktop nếu muốn chạy bằng Docker

## Cài đặt nhanh

```bash
git clone https://github.com/Trananh04/mktask.git
cd mktask
npm install
cp .env.example .env
```

Kiểm tra lại `.env` trước khi chạy. Các giá trị quan trọng:

```env
DATABASE_URL="postgresql://mktask:mktask@localhost:5432/mktask"
JWT_SECRET="thay-bang-chuoi-bi-mat"
JWT_REFRESH_SECRET="thay-bang-chuoi-bi-mat-khac"
ENCRYPTION_KEY="thay-bang-chuoi-32-byte"
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:8081
CORS_ORIGIN="http://localhost:8081"
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

## Chạy dự án bằng local script

Cách này phù hợp khi máy đã cài PostgreSQL tools (`initdb`, `pg_ctl`, `psql`, `createdb`). Script sẽ tạo database local trong thư mục `.local/`, chạy migration, seed dữ liệu và mở cả frontend/backend.

```bash
npm run dev:local
```

Truy cập:

- Frontend: `http://localhost:8081`
- Backend API: `http://localhost:8080/api`
- Swagger API Docs: `http://localhost:8080/api/docs`

Dừng môi trường local:

```bash
npm run dev:local:stop
```

## Chạy bằng Docker

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

Docker dev compose mở:

- PostgreSQL trong container, publish ra port `1111`
- Redis ở port `2222`
- Backend ở port `8080`
- Frontend ở port `8081`

Dừng Docker:

```bash
docker compose -f docker-compose.dev.yml down
```

## Chạy thủ công

Nếu bạn tự chạy PostgreSQL và Redis:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Chạy riêng từng phần:

```bash
npm run dev:frontend
npm run dev:backend
```

## Lệnh thường dùng

```bash
npm run dev              # Chạy frontend + backend
npm run dev:local        # Chạy môi trường local tự bootstrap PostgreSQL
npm run dev:local:stop   # Dừng môi trường local
npm run dev:infra        # Chạy PostgreSQL + Redis bằng Docker
npm run dev:infra:down   # Dừng PostgreSQL + Redis Docker

npm run db:generate      # Generate Prisma client
npm run db:migrate       # Chạy migration dev
npm run db:migrate:deploy # Deploy migration production
npm run db:seed          # Seed dữ liệu mẫu
npm run db:seed:admin    # Seed admin user
npm run db:reset         # Reset database, xóa dữ liệu
npm run db:studio        # Mở Prisma Studio

npm run lint             # Lint toàn bộ workspace
npm run test             # Chạy test toàn bộ workspace
npm run test:backend     # Test backend
npm run test:frontend    # Test frontend
npm run build            # Build frontend + backend
npm run build:dist       # Build gói distribution
```

## Kiểm thử

```bash
npm run lint
npm run test:backend
npm run test:frontend
npm run build
```

Với Playwright e2e frontend:

```bash
npm run test:e2e --workspace=frontend
```

## Cấu trúc thư mục

```txt
mktask/
├── backend/                 # NestJS API, Prisma, module nghiệp vụ
├── frontend/                # Next.js UI
├── ai-agent/                # Dịch vụ/thử nghiệm phân tích AI phụ trợ
├── docker/                  # Entrypoint và tài liệu Docker
├── docs/                    # Spec và hướng dẫn AI
├── plans/                   # Kế hoạch phát triển
├── scripts/                 # Script build/dev
├── docker-compose.dev.yml   # Docker Compose cho dev
├── package.json             # Monorepo npm workspaces
└── README.md
```

## Ghi chú bảo mật

- Không commit file `.env`, API key, token đăng nhập hoặc dữ liệu test auth.
- Đổi `JWT_SECRET`, `JWT_REFRESH_SECRET` và `ENCRYPTION_KEY` trước khi deploy.
- AI key được cấu hình trong ứng dụng theo user; không hard-code key vào source.
- Với hành động tạo/xóa/cập nhật hàng loạt, nên yêu cầu người dùng xác nhận trước khi áp dụng.

## Troubleshooting

- **Không kết nối được database**: kiểm tra PostgreSQL đang chạy và `DATABASE_URL` đúng.
- **Redis lỗi**: kiểm tra `REDIS_HOST`, `REDIS_PORT` và container Redis.
- **Port bị chiếm**: backend dùng `8080`, frontend dùng `8081`.
- **Prisma lỗi sau khi pull code**: chạy `npm run db:generate` và `npm run db:migrate`.
- **AI không hoạt động**: bật AI trong Settings, nhập model/API URL/API key và bấm test connection.

## License

Dự án dùng giấy phép trong file `LICENSE.md` nếu repository có kèm file này.
