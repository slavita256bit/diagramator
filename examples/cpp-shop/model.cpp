#include "model.hpp"

namespace shop {

int Product::instances_ = 0;

Category::Category(std::string name) : name_(std::move(name)) {}
const std::string& Category::name() const { return name_; }

Product::Product(std::string sku, Money basePrice)
    : sku_(std::move(sku)), basePrice_(std::move(basePrice)) { ++instances_; }
double Product::price() const { return basePrice_.cents / 100.0; }
std::string Product::describe() const { return sku_; }
int Product::instances() { return instances_; }

Book::Book(std::string sku, Money price, std::string author)
    : Product(std::move(sku), std::move(price)), author_(std::move(author)) {}
double Book::weightKg() const { return 0.3 + pages_ * 0.001; }

double Laptop::weightKg() const { return 1.5; }
double Laptop::price() const { return Product::price() * 1.2; }

Customer::Customer(std::string email) : email_(std::move(email)) {}
const std::string& Customer::email() const { return email_; }

OrderLine::OrderLine(const Product& product, int quantity) : product_(&product), quantity_(quantity) {}
double OrderLine::total() const { return product_->price() * quantity_; }

Order::Order(Customer& customer) : customer_(&customer) {}
void Order::addLine(const Product& product, int quantity) { lines_.emplace_back(product, quantity); }
double Order::total() const {
    double sum = 0;
    for (const auto& l : lines_) sum += l.total();
    return sum;
}
std::string Order::describe() const { return "Order for " + customer_->email(); }

double NoDiscount::apply(const Order&, double amount) const { return amount; }
PercentDiscount::PercentDiscount(double percent) : percent_(percent) {}
double PercentDiscount::apply(const Order&, double amount) const { return amount * (1 - percent_ / 100); }

Checkout::Checkout(std::unique_ptr<DiscountPolicy> policy) : policy_(std::move(policy)), catalog_(nullptr) {}
Money Checkout::charge(const Order& order, Customer&) {
    return Money{static_cast<long>(policy_->apply(order, order.total()) * 100), "EUR"};
}

} // namespace shop
