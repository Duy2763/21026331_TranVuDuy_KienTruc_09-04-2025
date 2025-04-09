# Hệ thống quản lý bán hàng Microservices

Hệ thống quản lý bán hàng được xây dựng bằng kiến trúc Microservices, sử dụng Node.js, Express, MongoDB và RabbitMQ.

## Kiến trúc hệ thống

Hệ thống bao gồm các thành phần sau:

- **API Gateway**: Đóng vai trò như một điểm truy cập duy nhất cho client, chuyển tiếp yêu cầu đến các Microservices thích hợp.
- **Product Service**: Quản lý thông tin sản phẩm (tên, giá, mô tả, tồn kho).
- **Order Service**: Quản lý đơn hàng (tạo, xem, hủy đơn hàng).
- **Customer Service**: Quản lý thông tin khách hàng (tên, địa chỉ, thông tin liên lạc).
- **RabbitMQ**: Message broker để giao tiếp không đồng bộ giữa các dịch vụ.
- **MongoDB**: Cơ sở dữ liệu NoSQL cho mỗi dịch vụ, tuân thủ nguyên tắc "Database per Service".

## Sơ đồ giao tiếp giữa các dịch vụ

```
┌──────────────┐                           ┌─────────────────┐
│    Client    │                           │    API Gateway  │
└──────┬───────┘                           └────────┬────────┘
       │                                            │
       │           HTTP Request                     │
       ├────────────────────────────────────────────▶
       │                                            │
       │                                            │
       │                                            │
       │                                            ▼
┌──────┴────────────────────────────────────────────┬────────────────────────────────────────────────┐
│                                                   │                                                 │
│                                                   │                                                 │
▼                                                   ▼                                                 ▼
┌──────────────┐    HTTP   ┌──────────────┐    HTTP   ┌──────────────┐      HTTP     ┌──────────────┐
│ Product      │◀─────────▶│ Order        │◀─────────▶│ Customer     │◀──────────────│  Other       │
│ Service      │    REST   │ Service      │    REST   │ Service      │      REST     │  Services    │
└──────┬───────┘           └──────┬───────┘           └──────┬───────┘               └──────────────┘
       │                          │                          │
       │                          │                          │
       │                          ▼                          │
       │               ┌──────────────────────┐             │
       │               │                      │             │
       └──────────────▶│      RabbitMQ        │◀────────────┘
                       │  (Message Broker)    │
                       └──────────────────────┘
```

## Luồng xử lý đơn hàng

1. **Client** gửi yêu cầu tạo đơn hàng đến **API Gateway**.
2. **API Gateway** chuyển tiếp yêu cầu đến **Order Service**.
3. **Order Service** kiểm tra thông tin khách hàng bằng cách gọi **Customer Service** qua HTTP REST.
4. **Order Service** kiểm tra tồn kho sản phẩm bằng cách gọi **Product Service** qua HTTP REST.
5. **Order Service** tạo đơn hàng nếu tất cả điều kiện được đáp ứng.
6. **Order Service** gửi thông báo tạo đơn hàng thành công đến RabbitMQ.
7. **Product Service** lắng nghe sự kiện từ RabbitMQ và cập nhật tồn kho sản phẩm.
8. **Order Service** gửi phản hồi về **API Gateway** và cuối cùng đến **Client**.

## Cài đặt và chạy hệ thống

### Yêu cầu
- Docker và Docker Compose
- Node.js (để phát triển)

### Chạy hệ thống
```bash
# Clone repository
git clone <repository-url>
cd microservices-sales-system

# Chạy toàn bộ hệ thống với Docker Compose
docker-compose up
```

## API Endpoints

### Product Service (http://localhost:8001)
- `GET /api/products`: Lấy danh sách sản phẩm
- `GET /api/products/:id`: Lấy thông tin sản phẩm theo ID
- `POST /api/products`: Tạo sản phẩm mới
- `PUT /api/products/:id`: Cập nhật sản phẩm
- `DELETE /api/products/:id`: Xóa sản phẩm
- `POST /api/products/check-stock`: Kiểm tra tồn kho
- `POST /api/products/update-stock`: Cập nhật tồn kho

### Order Service (http://localhost:8002)
- `GET /api/orders`: Lấy danh sách đơn hàng
- `GET /api/orders/:id`: Lấy thông tin đơn hàng theo ID
- `POST /api/orders`: Tạo đơn hàng mới
- `PATCH /api/orders/:id/update-status`: Cập nhật trạng thái đơn hàng
- `DELETE /api/orders/:id`: Xóa đơn hàng
- `GET /api/orders/customer/:customerId`: Lấy đơn hàng theo khách hàng

### Customer Service (http://localhost:8003)
- `GET /api/customers`: Lấy danh sách khách hàng
- `GET /api/customers/:id`: Lấy thông tin khách hàng theo ID
- `POST /api/customers`: Đăng ký khách hàng mới
- `POST /api/customers/login`: Đăng nhập
- `PUT /api/customers/:id`: Cập nhật thông tin khách hàng
- `DELETE /api/customers/:id`: Xóa khách hàng
- `POST /api/customers/:id/addresses`: Thêm địa chỉ mới
- `PUT /api/customers/:id/addresses/:addressId`: Cập nhật địa chỉ
- `DELETE /api/customers/:id/addresses/:addressId`: Xóa địa chỉ

## Tác giả
- Vgng