def quote(unit_price, quantity, discount, shipping):
    subtotal = unit_price * quantity
    discounted = max(0, subtotal - discount)
    total = discounted + shipping
    return total
