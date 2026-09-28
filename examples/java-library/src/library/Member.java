package library;

import java.util.ArrayList;
import java.util.List;

public class Member {
    private final String cardId;
    private final List<Loan> loans = new ArrayList<>();

    public Member(String cardId) { this.cardId = cardId; }

    public List<Loan> getLoans() { return loans; }
    public boolean canBorrow() { return loans.size() < 5; }
}
