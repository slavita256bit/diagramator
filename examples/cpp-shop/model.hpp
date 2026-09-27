#pragma once
#include <memory>
#include <string>
#include <vector>

namespace shop {

/// Interface: anything that has a price.
class IPriced {
public:
    virtual ~IPriced() = default;
    virtual double price() const = 0;
};

/// Interface: anything that can be printed.
class IPrintable {
public:
    virtual ~IPrintable() = default;
    virtual std::string describe() const = 0;
};

struct Money {
    long cents;
    std::string currency;
};

class Category {
public:
    explicit Category(std::string name);
    const std::string& name() const;
private:
    std::string name_;
    Category* parent_ = nullptr;  // self-association
};

/// Abstract base product.
class Product : public IPriced, public IPrintable {
public:
    Product(std::string sku, Money basePrice);
    virtual ~Product() = default;
    double price() const override;
    std::string describe() const override;
    virtual double weightKg() const = 0;
    static int instances();
protected:
    std::string sku_;
    Money basePrice_;                    // composition
    std::shared_ptr<Category> category_; // association
private:
    static int instances_;
};

class Book : public Product {
public:
    Book(std::string sku, Money price, std::string author);
    double weightKg() const override;
private:
    std::string author_;
    int pages_ = 0;
};

class Laptop : public Product {
public:
    double weightKg() const override;
    double price() const override;
private:
    double screenInches_;
    int ramGb_;
};

template <typename T>
class Repository {
public:
    void add(std::unique_ptr<T> item);
    T* find(const std::string& key) const;
    std::size_t size() const;
private:
    std::vector<std::unique_ptr<T>> items_;
};

class Customer {
public:
    explicit Customer(std::string email);
    const std::string& email() const;
private:
    std::string email_;
};

class OrderLine {
public:
    OrderLine(const Product& product, int quantity);
    double total() const;
private:
    const Product* product_;  // association (non-owning)
    int quantity_;
};

class Order : public IPrintable {
public:
    explicit Order(Customer& customer);
    void addLine(const Product& product, int quantity);
    double total() const;
    std::string describe() const override;
private:
    std::vector<OrderLine> lines_;  // composition
    Customer* customer_;            // association
};

/// Strategy hierarchy.
class DiscountPolicy {
public:
    virtual ~DiscountPolicy() = default;
    virtual double apply(const Order& order, double amount) const = 0;
};

class NoDiscount : public DiscountPolicy {
public:
    double apply(const Order& order, double amount) const override;
};

class PercentDiscount : public DiscountPolicy {
public:
    explicit PercentDiscount(double percent);
    double apply(const Order& order, double amount) const override;
private:
    double percent_;
};

class Checkout {
public:
    explicit Checkout(std::unique_ptr<DiscountPolicy> policy);
    Money charge(const Order& order, Customer& customer);  // dependencies
private:
    std::unique_ptr<DiscountPolicy> policy_;  // composition
    Repository<Product>* catalog_;            // association
};

} // namespace shop
