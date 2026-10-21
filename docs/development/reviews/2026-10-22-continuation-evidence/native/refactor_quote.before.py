def quote(unit_price, quantity, discount, shipping):
    return max(0, unit_price * quantity - discount) + shipping
