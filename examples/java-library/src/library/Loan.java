package library;

import java.time.LocalDate;

public class Loan {
    private final Item item;
    private final Member member;
    private final LocalDate due;

    public Loan(Item item, Member member) {
        this.item = item;
        this.member = member;
        this.due = LocalDate.now().plusDays(item.loanDays());
    }

    public boolean isOverdue(LocalDate today) { return today.isAfter(due); }
}
